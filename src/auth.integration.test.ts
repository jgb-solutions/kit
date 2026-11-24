/**
 * The preset with a real Better Auth, on an in-memory bun:sqlite database: sign-up, username and email
 * sign-in, the Bearer session the mobile app uses, the first admins, usernames for accounts made
 * without one, closed sign-up, and the signed-in flag cookie.
 */
import { Database } from 'bun:sqlite'
import { describe, expect, expectTypeOf, test } from 'bun:test'
import { betterAuth } from 'better-auth'
import { getMigrations } from 'better-auth/db/migration'
import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements, userAc } from 'better-auth/plugins/admin/access'
import { authSettings, standardAuthOptions, toAuthUser } from './auth'
import { defineRoles } from './auth/rules'

const SITE = 'http://localhost:3000'
const { roleOf } = defineRoles({ roles: ['user', 'admin'], defaultRole: 'user', adminPanel: ['admin'] })
const ac = createAccessControl({ ...defaultStatements })
const roles = { user: ac.newRole({ ...userAc.statements }), admin: ac.newRole({ ...adminAc.statements }) }

async function makeAuth(env: Record<string, string> = {}) {
  const db = new Database(':memory:')
  const options = standardAuthOptions({
    appName: 'Example',
    siteUrl: SITE,
    settings: authSettings({ E2E: '1', ADMIN_EMAILS: 'boss@example.com', ...env }),
    database: db,
    admin: { ac, roles, defaultRole: 'user', adminRoles: ['admin'] },
    takenUsernames: async (candidates) => {
      const rows = db
        .query<{ username: string }, string[]>(`select username from user where username in (${candidates.map(() => '?').join(',')})`)
        .all(...candidates)
      return new Set(rows.map((row) => row.username))
    },
    usernameFallback: 'member',
    signedInFlag: 'example_in',
    beforeDeleteUser: async () => {},
  })
  const { runMigrations } = await getMigrations(options)
  await runMigrations()
  return { auth: betterAuth(options), db }
}

const json = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${SITE}/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: SITE, ...headers },
    body: JSON.stringify(body),
  })

describe('standardAuthOptions with Better Auth', () => {
  test('sign-up with a username, then sign-in by username and by email, and a Bearer session', async () => {
    const { auth } = await makeAuth()
    const signUp = await auth.handler(
      json('/sign-up/email', { name: 'Ana', username: 'ana', email: 'ana@example.com', password: 'correct horse battery' }),
    )
    expect(signUp.status).toBe(200)
    expect(signUp.headers.get('set-cookie')).toContain('example_in=1')

    const byUsername = await auth.handler(json('/sign-in/username', { username: 'ana', password: 'correct horse battery' }))
    expect(byUsername.status).toBe(200)
    const token = byUsername.headers.get('set-auth-token')
    expect(token).toBeTruthy()

    const byEmail = await auth.handler(json('/sign-in/email', { email: 'ana@example.com', password: 'correct horse battery' }))
    expect(byEmail.status).toBe(200)

    const session = await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${token}` }) })
    expect(toAuthUser(session?.user, roleOf)).toMatchObject({ username: 'ana', email: 'ana@example.com', role: 'user' })

    const wrong = await auth.handler(json('/sign-in/username', { username: 'ana', password: 'wrong password!!' }))
    expect(wrong.status).toBe(401)
  })

  test("the plugins' endpoints keep their types through the preset", async () => {
    const { auth } = await makeAuth()
    expectTypeOf(auth.api.signInUsername).toBeFunction()
    expectTypeOf(auth.api.listPasskeys).toBeFunction()
    expectTypeOf(auth.api.setRole).toBeFunction()
    expectTypeOf(auth.api.banUser).toBeFunction()
  })

  test('passwords shorter than 12 characters are refused', async () => {
    const { auth } = await makeAuth()
    const response = await auth.handler(
      json('/sign-up/email', { name: 'Ben', username: 'ben', email: 'ben@example.com', password: 'short' }),
    )
    expect(response.status).toBe(400)
  })

  test('an address in ADMIN_EMAILS starts as admin', async () => {
    const { auth } = await makeAuth()
    const response = await auth.api.signUpEmail({
      body: { name: 'Boss', username: 'boss', email: 'Boss@Example.com', password: 'correct horse battery' },
    })
    expect(response.user).toMatchObject({ role: 'admin' })
  })

  test('an account made without a username gets one from its name, with a number when taken', async () => {
    const { auth } = await makeAuth()
    await auth.api.signUpEmail({
      body: { name: 'Marie Dupont', username: 'marie.dupont', email: 'm1@example.com', password: 'correct horse battery' },
    })
    const ctx = await auth.$context
    const created = await ctx.internalAdapter.createUser({ name: 'Marie Dupont', email: 'm2@example.com' }, { method: 'oauth' })
    expect(created).toMatchObject({ username: expect.stringMatching(/^marie\.dupont\d{4}$/), role: 'user' })
  })

  test('SIGN_UP=off closes sign-up', async () => {
    const { auth } = await makeAuth({ SIGN_UP: 'off' })
    const response = await auth.handler(
      json('/sign-up/email', { name: 'Cy', username: 'cy', email: 'cy@example.com', password: 'correct horse battery' }),
    )
    expect(response.status).toBe(400)
  })

  test('sign-out clears the signed-in flag', async () => {
    const { auth } = await makeAuth()
    const signUp = await auth.handler(
      json('/sign-up/email', { name: 'Di', username: 'di', email: 'di@example.com', password: 'correct horse battery' }),
    )
    const token = signUp.headers.get('set-auth-token') ?? ''
    const out = await auth.handler(json('/sign-out', {}, { authorization: `Bearer ${token}` }))
    expect(out.headers.get('set-cookie')).toMatch(/example_in=;.*Max-Age=0/i)
  })
})
