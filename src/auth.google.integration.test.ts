/**
 * Google with a real Better Auth, "merge only confirmed": ID tokens signed with a test key, and
 * Google's key endpoint answered with it (no network). Covers sign-in, the refusal to join an
 * unconfirmed account, joining a confirmed one, and connecting Google while signed in.
 */
import { Database } from 'bun:sqlite'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { betterAuth } from 'better-auth'
import { getMigrations } from 'better-auth/db/migration'
import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements, userAc } from 'better-auth/plugins/admin/access'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { authSettings, standardAuthOptions } from './auth'
import { ACCOUNT_NOT_LINKED, authErrorCode, GOOGLE_ALREADY_LINKED } from './auth/rules'

const SITE = 'http://localhost:3000'
const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs'
const PICTURE = 'https://lh3.googleusercontent.com/a/test'
const ac = createAccessControl({ ...defaultStatements })
const roles = { user: ac.newRole({ ...userAc.statements }), admin: ac.newRole({ ...adminAc.statements }) }

const keys = await generateKeyPair('RS256')
const realFetch = globalThis.fetch

beforeAll(async () => {
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' }
  const fake = async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url.startsWith(GOOGLE_CERTS)) return Response.json({ keys: [jwk] })
    return realFetch(input, init)
  }
  globalThis.fetch = Object.assign(fake, { preconnect: realFetch.preconnect })
})
afterAll(() => {
  globalThis.fetch = realFetch
})

/** A Google ID token for this address, signed with the test key. */
function googleToken(email: string, sub: string, emailVerified = true) {
  return new SignJWT({ email, email_verified: emailVerified, name: 'Google Person', picture: PICTURE })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer('https://accounts.google.com')
    .setAudience('web-client')
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(keys.privateKey)
}

async function makeAuth() {
  const db = new Database(':memory:')
  const options = standardAuthOptions({
    appName: 'Example',
    siteUrl: SITE,
    settings: authSettings({ E2E: '1', GOOGLE_CLIENT_ID: 'web-client', GOOGLE_CLIENT_SECRET: 'secret' }),
    database: db,
    admin: { ac, roles, defaultRole: 'user', adminRoles: ['admin'] },
    takenUsernames: async () => new Set(),
    usernameFallback: 'member',
  })
  const { runMigrations } = await getMigrations(options)
  await runMigrations()
  const auth = betterAuth(options)
  const providersOf = (userId: string) =>
    db
      .query<{ provider_id: string }, [string]>('select providerId as provider_id from account where userId = ?')
      .all(userId)
      .map((row) => row.provider_id)
      .sort()
  return { auth, db, providersOf }
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${SITE}/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: SITE, ...headers },
    body: JSON.stringify(body),
  })

const googleSignIn = async (email: string, sub: string) =>
  post('/sign-in/social', { provider: 'google', disableRedirect: true, idToken: { token: await googleToken(email, sub) } })

const signUp = (auth: Awaited<ReturnType<typeof makeAuth>>['auth'], body: Record<string, string>) =>
  auth.handler(post('/sign-up/email', { password: 'correct horse battery', ...body }))

describe('Google, merge only confirmed', () => {
  test('a new Google address makes a confirmed account', async () => {
    const { auth, providersOf } = await makeAuth()
    const response = await auth.handler(await googleSignIn('new@example.com', 'g-new'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { user: { id: string; emailVerified: boolean; image: string } }
    expect(body.user).toMatchObject({ emailVerified: true, image: PICTURE })
    expect(providersOf(body.user.id)).toEqual(['google'])
  })

  test('Google refuses to join an unconfirmed email and password account, and adds no account row', async () => {
    const { auth, providersOf } = await makeAuth()
    const created = await signUp(auth, { name: 'Ana', username: 'ana', email: 'ana@example.com' })
    const { user } = (await created.json()) as { user: { id: string } }

    const response = await auth.handler(await googleSignIn('ana@example.com', 'g-ana'))
    expect(response.status).toBe(401)
    expect(authErrorCode(await response.json())).toBe(ACCOUNT_NOT_LINKED)
    expect(providersOf(user.id)).toEqual(['credential'])
  })

  test('Google joins a confirmed account (made by an admin) and ends its other sessions', async () => {
    const { auth, providersOf } = await makeAuth()
    const created = await signUp(auth, { name: 'Boss', username: 'boss', email: 'boss@example.com' })
    const { user } = (await created.json()) as { user: { id: string } }
    const oldToken = created.headers.get('set-auth-token') ?? ''
    const ctx = await auth.$context
    await ctx.internalAdapter.updateUser(user.id, { emailVerified: true })

    const response = await auth.handler(await googleSignIn('boss@example.com', 'g-boss'))
    expect(response.status).toBe(200)
    expect(providersOf(user.id)).toEqual(['credential', 'google'])
    expect(await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${oldToken}` }) })).toBeNull()
    const again = await auth.handler(await googleSignIn('boss@example.com', 'g-boss'))
    expect(again.status).toBe(200)
  })

  test("a Google sign-in from a browser signed into another account still ends the joined account's sessions", async () => {
    const { auth } = await makeAuth()
    const someone = await signUp(auth, { name: 'Other', username: 'other', email: 'other@example.com' })
    const someoneToken = someone.headers.get('set-auth-token') ?? ''
    const created = await signUp(auth, { name: 'Bo', username: 'bobby', email: 'bo@example.com' })
    const { user } = (await created.json()) as { user: { id: string } }
    const boToken = created.headers.get('set-auth-token') ?? ''
    await (await auth.$context).internalAdapter.updateUser(user.id, { emailVerified: true })

    const joined = await auth.handler(
      post(
        '/sign-in/social',
        { provider: 'google', disableRedirect: true, idToken: { token: await googleToken('bo@example.com', 'g-bo') } },
        { authorization: `Bearer ${someoneToken}` },
      ),
    )
    expect(joined.status).toBe(200)
    expect(await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${boToken}` }) })).toBeNull()
    expect(await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${someoneToken}` }) })).not.toBeNull()
  })

  test('connecting Google while signed in: any Google address, and every session stays', async () => {
    const { auth, providersOf } = await makeAuth()
    // A username account: its address is a placeholder that no Google address could match.
    const created = await signUp(auth, { name: 'Cyrus', username: 'cyrus', email: 'x1@users.invalid' })
    const { user } = (await created.json()) as { user: { id: string } }
    const other = created.headers.get('set-auth-token') ?? ''
    const signedIn = await auth.handler(post('/sign-in/username', { username: 'cyrus', password: 'correct horse battery' }))
    const mine = signedIn.headers.get('set-auth-token') ?? ''

    const linked = await auth.handler(
      post(
        '/link-social',
        { provider: 'google', disableRedirect: true, idToken: { token: await googleToken('cy.real@example.com', 'g-cy') } },
        { authorization: `Bearer ${mine}` },
      ),
    )
    expect(linked.status).toBe(200)
    expect(providersOf(user.id)).toEqual(['credential', 'google'])
    expect(await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${mine}` }) })).not.toBeNull()
    // The owner's other device stays signed in (Control Center, 2026-11-24).
    expect(await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${other}` }) })).not.toBeNull()
    const ctx = await auth.$context
    expect(await ctx.internalAdapter.findUserById(user.id)).toMatchObject({ image: PICTURE })

    // Afterwards, Continue with Google signs into this account.
    const viaGoogle = await auth.handler(await googleSignIn('cy.real@example.com', 'g-cy'))
    expect(((await viaGoogle.json()) as { user: { id: string } }).user.id).toBe(user.id)
  })

  test('a Google account that belongs to another account can not be connected', async () => {
    const { auth } = await makeAuth()
    await auth.handler(await googleSignIn('dee@example.com', 'g-dee'))
    const created = await signUp(auth, { name: 'Eve', username: 'eve', email: 'eve@example.com' })
    const token = created.headers.get('set-auth-token') ?? ''
    const linked = await auth.handler(
      post(
        '/link-social',
        { provider: 'google', disableRedirect: true, idToken: { token: await googleToken('dee@example.com', 'g-dee') } },
        { authorization: `Bearer ${token}` },
      ),
    )
    expect(linked.status).toBe(409)
    expect(authErrorCode(await linked.json())).toBe(GOOGLE_ALREADY_LINKED)
  })
})
