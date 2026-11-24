/**
 * Google through the website's redirect flow, with a real Better Auth: the page starts at
 * /sign-in/social (or /link-social), the browser goes to Google, and Google comes back to
 * /callback/google with a code. Google is played here: its token endpoint answers the code with an
 * ID token signed by a test key, and its key endpoint with that key (no network). The browser's
 * cookies are carried between the steps as a browser would.
 *
 * Covers what the ID-token tests (auth.google.integration.test.ts) can't: the redirects. A new
 * address signs in and lands on `callbackURL`; an unconfirmed account is refused and the browser
 * goes to `errorCallbackURL?error=account_not_linked` (what the website's sign-in page words); a
 * confirmed one is joined and its other sessions end; connecting Google from the account page keeps
 * every session and lands back on the account page.
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
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
const PICTURE = 'https://lh3.googleusercontent.com/a/test'
const ac = createAccessControl({ ...defaultStatements })
const roles = { user: ac.newRole({ ...userAc.statements }), admin: ac.newRole({ ...adminAc.statements }) }

const keys = await generateKeyPair('RS256')
const realFetch = globalThis.fetch

/** The Google account the next code stands for: what Google's token endpoint answers. */
let googleUser: { email: string; sub: string; emailVerified: boolean } = { email: '', sub: '', emailVerified: true }
/** The codes Google's token endpoint was asked about, to prove the callback exchanged one. */
const exchanged: string[] = []

function googleToken({ email, sub, emailVerified }: typeof googleUser) {
  return new SignJWT({ email, email_verified: emailVerified, name: 'Google Person', picture: PICTURE })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer('https://accounts.google.com')
    .setAudience('web-client')
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(keys.privateKey)
}

beforeAll(async () => {
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' }
  const fake = async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url.startsWith(GOOGLE_CERTS)) return Response.json({ keys: [jwk] })
    if (url.startsWith(GOOGLE_TOKEN)) {
      const body = input instanceof Request ? await input.text() : String(init?.body ?? '')
      exchanged.push(new URLSearchParams(body).get('code') ?? '')
      return Response.json({
        access_token: 'google-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid email profile',
        id_token: await googleToken(googleUser),
      })
    }
    return realFetch(input, init)
  }
  globalThis.fetch = Object.assign(fake, { preconnect: realFetch.preconnect })
})
afterAll(() => {
  globalThis.fetch = realFetch
})

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
  return { auth, providersOf }
}

type Auth = Awaited<ReturnType<typeof makeAuth>>['auth']

/** A browser: keeps the cookies the site sets and sends them back, as a browser does. */
function browser(auth: Auth) {
  const jar = new Map<string, string>()
  const keep = (response: Response) => {
    for (const cookie of response.headers.getSetCookie()) {
      const [pair = ''] = cookie.split(';')
      const at = pair.indexOf('=')
      const name = pair.slice(0, at)
      const value = pair.slice(at + 1)
      if (/max-age=0/i.test(cookie) || value === '') jar.delete(name)
      else jar.set(name, value)
    }
    return response
  }
  const headers = (extra: Record<string, string> = {}) => ({
    origin: SITE,
    ...(jar.size ? { cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; ') } : {}),
    ...extra,
  })
  return {
    post: async (path: string, body: unknown) =>
      keep(
        await auth.handler(
          new Request(`${SITE}/api/auth${path}`, {
            method: 'POST',
            headers: headers({ 'content-type': 'application/json' }),
            body: JSON.stringify(body),
          }),
        ),
      ),
    get: async (url: string) => keep(await auth.handler(new Request(url, { headers: headers() }))),
    /** The session this browser is signed into (by its cookie), or null; read from the database. */
    session: () => auth.api.getSession({ headers: new Headers(headers()), query: { disableCookieCache: true } }),
    /** The same, as a page sees it: the preset's 5-minute cookie cache may answer first. */
    cachedSession: () => auth.api.getSession({ headers: new Headers(headers()) }),
  }
}

/**
 * The page's button: start the flow (`start` is /sign-in/social or /link-social), follow the browser
 * to Google, and let Google send it back to the callback with a code for `account`. Returns the
 * callback's answer: a redirect to where the page asked to land.
 */
async function throughGoogle(
  site: ReturnType<typeof browser>,
  start: '/sign-in/social' | '/link-social',
  account: typeof googleUser,
  pages = { callbackURL: '/account', errorCallbackURL: '/sign-in' },
) {
  const started = await site.post(start, { provider: 'google', ...pages })
  expect(started.status).toBe(200)
  const { url } = (await started.json()) as { url: string }
  const consent = new URL(url)
  expect(consent.origin).toBe('https://accounts.google.com')
  expect(consent.searchParams.get('redirect_uri')).toBe(`${SITE}/api/auth/callback/google`)
  // Google: the person picks `account`, and Google sends the browser back with a code and the state.
  googleUser = account
  const code = `code-${crypto.randomUUID()}`
  const callback = new URL(`${SITE}/api/auth/callback/google`)
  callback.searchParams.set('code', code)
  callback.searchParams.set('state', consent.searchParams.get('state') ?? '')
  const answer = await site.get(callback.toString())
  expect(exchanged).toContain(code)
  return answer
}

/** Where a redirect sends the browser, as a path with its query (the site's own pages). */
const landing = (response: Response) => {
  const location = response.headers.get('location') ?? ''
  const url = new URL(location, SITE)
  return { status: response.status, path: url.pathname, error: url.searchParams.get('error') }
}

const signUp = async (site: ReturnType<typeof browser>, body: Record<string, string>) => {
  const response = await site.post('/sign-up/email', { password: 'correct horse battery', ...body })
  expect(response.status).toBe(200)
  return ((await response.json()) as { user: { id: string } }).user
}

describe('Google through the redirect flow, merge only confirmed', () => {
  test('a new Google address makes an account, signs in and lands on the page asked for', async () => {
    const { auth, providersOf } = await makeAuth()
    const site = browser(auth)
    const answer = await throughGoogle(site, '/sign-in/social', { email: 'new@example.com', sub: 'g-new', emailVerified: true })
    expect(landing(answer)).toMatchObject({ status: 302, path: '/account', error: null })
    const session = await site.session()
    expect(session?.user).toMatchObject({ email: 'new@example.com', emailVerified: true, image: PICTURE })
    expect(providersOf(session?.user.id ?? '')).toEqual(['google'])
  })

  test('an unconfirmed account is refused: back to sign-in with account_not_linked, nothing joined, not signed in', async () => {
    const { auth, providersOf } = await makeAuth()
    const user = await signUp(browser(auth), { name: 'Ana', username: 'ana', email: 'ana@example.com' })
    const site = browser(auth)
    const answer = await throughGoogle(site, '/sign-in/social', { email: 'ana@example.com', sub: 'g-ana', emailVerified: true })
    const where = landing(answer)
    expect(where).toMatchObject({ status: 302, path: '/sign-in' })
    expect(authErrorCode(where.error ?? '')).toBe(ACCOUNT_NOT_LINKED)
    expect(providersOf(user.id)).toEqual(['credential'])
    expect(await site.session()).toBeNull()
  })

  test("Google's unconfirmed address never joins, even a confirmed account", async () => {
    const { auth, providersOf } = await makeAuth()
    const user = await signUp(browser(auth), { name: 'Cam', username: 'cam', email: 'cam@example.com' })
    await (await auth.$context).internalAdapter.updateUser(user.id, { emailVerified: true })
    const site = browser(auth)
    const answer = await throughGoogle(site, '/sign-in/social', { email: 'cam@example.com', sub: 'g-cam', emailVerified: false })
    expect(landing(answer)).toMatchObject({ status: 302, path: '/sign-in' })
    expect(providersOf(user.id)).toEqual(['credential'])
    expect(await site.session()).toBeNull()
  })

  test('a confirmed account is joined: signed in, and its other sessions end', async () => {
    const { auth, providersOf } = await makeAuth()
    const phone = browser(auth)
    const user = await signUp(phone, { name: 'Boss', username: 'boss', email: 'boss@example.com' })
    await (await auth.$context).internalAdapter.updateUser(user.id, { emailVerified: true })
    expect(await phone.session()).not.toBeNull()

    const laptop = browser(auth)
    const answer = await throughGoogle(laptop, '/sign-in/social', { email: 'boss@example.com', sub: 'g-boss', emailVerified: true })
    expect(landing(answer)).toMatchObject({ status: 302, path: '/account', error: null })
    expect(providersOf(user.id)).toEqual(['credential', 'google'])
    expect((await laptop.session())?.user.id).toBe(user.id)
    expect(await phone.session()).toBeNull()
    // The phone's session row is gone; its cookie cache can still answer for up to 5 minutes
    // (the preset's session.cookieCache), then it is signed out too.
    expect((await phone.cachedSession())?.user.id).toBe(user.id)
  })

  test('connecting Google from the account page: any Google address, back to the account page, every session stays', async () => {
    const { auth, providersOf } = await makeAuth()
    const other = browser(auth)
    // A username account: its address is a placeholder that no Google address could match.
    const user = await signUp(other, { name: 'Cyrus', username: 'cyrus', email: 'x1@users.invalid' })
    const site = browser(auth)
    expect((await site.post('/sign-in/username', { username: 'cyrus', password: 'correct horse battery' })).status).toBe(200)

    const answer = await throughGoogle(
      site,
      '/link-social',
      { email: 'cy.real@example.com', sub: 'g-cy', emailVerified: true },
      { callbackURL: '/account?connected=google', errorCallbackURL: '/account' },
    )
    expect(landing(answer)).toMatchObject({ status: 302, path: '/account', error: null })
    expect(answer.headers.get('location')).toContain('connected=google')
    expect(providersOf(user.id)).toEqual(['credential', 'google'])
    expect((await site.session())?.user.id).toBe(user.id)
    expect((await other.session())?.user.id).toBe(user.id)

    // Afterwards, Continue with Google signs into this account from a new browser.
    const fresh = browser(auth)
    await throughGoogle(fresh, '/sign-in/social', { email: 'cy.real@example.com', sub: 'g-cy', emailVerified: true })
    expect((await fresh.session())?.user.id).toBe(user.id)
  })

  test("connecting a Google account that belongs to another account: back to the account page with Google's error", async () => {
    const { auth, providersOf } = await makeAuth()
    await throughGoogle(browser(auth), '/sign-in/social', { email: 'dee@example.com', sub: 'g-dee', emailVerified: true })
    const site = browser(auth)
    const user = await signUp(site, { name: 'Eve', username: 'eve', email: 'eve@example.com' })
    const answer = await throughGoogle(
      site,
      '/link-social',
      { email: 'dee@example.com', sub: 'g-dee', emailVerified: true },
      { callbackURL: '/account?connected=google', errorCallbackURL: '/account' },
    )
    const where = landing(answer)
    expect(where).toMatchObject({ status: 302, path: '/account' })
    expect(authErrorCode(where.error ?? '')).toBe(GOOGLE_ALREADY_LINKED)
    expect(providersOf(user.id)).toEqual(['credential'])
  })
})
