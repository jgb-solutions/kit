import { describe, expect, mock, test } from 'bun:test'
import {
  afterAccountSaved,
  androidOrigin,
  asPublicRequest,
  assetLinks,
  authSettings,
  counterRateLimit,
  freeUsername,
  googleProvider,
  passkeyOrigins,
  pictureFromIdToken,
  roleForNewUser,
  standardAuthOptions,
  toAuthUser,
  trustedBaseUrl,
  type CounterStore,
} from './auth'
import { defineRoles } from './auth/rules'

describe('authSettings', () => {
  test('needs a secret, except on the E2E test server', () => {
    expect(() => authSettings({})).toThrow('BETTER_AUTH_SECRET')
    expect(authSettings({ E2E: '1' }).secret.length).toBeGreaterThanOrEqual(32)
    expect(authSettings({ E2E: '1' }).rateLimit).toBe(false)
  })

  test('E2E=1 is refused in production', () => {
    expect(() => authSettings({ E2E: '1', NODE_ENV: 'production' })).toThrow('E2E=1')
    expect(() => authSettings({ E2E: '1', NODE_ENV: 'production', BETTER_AUTH_SECRET: 's'.repeat(32) })).toThrow('E2E=1')
  })

  test('reads sign-up, the first admins and Google', () => {
    const settings = authSettings({
      BETTER_AUTH_SECRET: 's'.repeat(32),
      SIGN_UP: 'off',
      ADMIN_EMAILS: ' Ana@Example.com, ,ben@example.com',
      GOOGLE_CLIENT_ID: 'web',
      GOOGLE_CLIENT_SECRET: 'shh',
      GOOGLE_MOBILE_CLIENT_IDS: 'android, ios',
    })
    expect(settings.signUp).toBe(false)
    expect(settings.rateLimit).toBe(true)
    expect(settings.adminEmails).toEqual(['ana@example.com', 'ben@example.com'])
    expect(settings.google).toEqual({ clientId: ['web', 'android', 'ios'], clientSecret: 'shh' })
  })

  test('Google is off unless both keys are set', () => {
    expect(authSettings({ BETTER_AUTH_SECRET: 's', GOOGLE_CLIENT_ID: 'web' }).google).toBeNull()
  })
})

test('roleForNewUser: the first admins come from ADMIN_EMAILS, confirmed addresses only', () => {
  expect(roleForNewUser({ email: ' ANA@example.com', emailVerified: true }, ['ana@example.com'], 'user', 'admin')).toBe('admin')
  expect(roleForNewUser({ email: 'ana@example.com', emailVerified: false }, ['ana@example.com'], 'user', 'admin')).toBe('user')
  expect(roleForNewUser({ email: 'ana@example.com' }, ['ana@example.com'], 'user', 'admin')).toBe('user')
  expect(roleForNewUser({ email: 'ben@example.com', emailVerified: true }, ['ana@example.com'], 'user', 'admin')).toBe('user')
})

test('trustedBaseUrl: only the site and local hosts', () => {
  expect(trustedBaseUrl('https://app.example.com')).toEqual({
    allowedHosts: ['app.example.com', 'localhost:*', '127.0.0.1:*'],
    protocol: 'auto',
    fallback: 'https://app.example.com',
  })
})

describe('Android', () => {
  test("a certificate's SHA-256 becomes Android's WebAuthn origin (base64url, no padding)", () => {
    const hex = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0').toUpperCase()).join(':')
    expect(androidOrigin(hex)).toBe('android:apk-key-hash:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8')
  })

  test('asset links cover app links and passkeys, for the package given', () => {
    const [statement] = assetLinks('com.example.app', ['AA:BB'])
    expect(statement?.relation).toEqual(['delegate_permission/common.handle_all_urls', 'delegate_permission/common.get_login_creds'])
    expect(statement?.target).toEqual({ namespace: 'android_app', package_name: 'com.example.app', sha256_cert_fingerprints: ['AA:BB'] })
  })

  test('passkeyOrigins: the site, local origins and the app', () => {
    expect(passkeyOrigins('https://app.example.com/', { local: ['http://localhost:5173'], androidCertSha256: ['00:01'] })).toEqual([
      'https://app.example.com',
      'http://localhost:5173',
      'android:apk-key-hash:AAE',
    ])
  })
})

describe('counterRateLimit', () => {
  const memory = (): CounterStore => {
    const counts = new Map<string, number>()
    return { incr: async (key) => counts.set(key, (counts.get(key) ?? 0) + 1).get(key)! }
  }

  test('allows up to max per window, then says when to retry', async () => {
    let now = 120_000
    const store = memory()
    const limit = counterRateLimit(
      () => store,
      () => now,
    )
    const rule = { window: 60, max: 2 }
    expect((await limit.consume('ip:1', rule)).allowed).toBe(true)
    expect((await limit.consume('ip:1', rule)).allowed).toBe(true)
    now += 15_000
    expect(await limit.consume('ip:1', rule)).toEqual({ allowed: false, retryAfter: 45 })
    expect((await limit.consume('ip:2', rule)).allowed).toBe(true)
    now = 180_000
    expect((await limit.consume('ip:1', rule)).allowed).toBe(true)
  })

  test('lets attempts through when the store is down', async () => {
    const down: CounterStore = { incr: () => Promise.reject(new Error('down')) }
    const warn = console.warn
    console.warn = () => {}
    try {
      expect(await counterRateLimit(() => down).consume('ip:1', { window: 60, max: 1 })).toEqual({ allowed: true, retryAfter: null })
    } finally {
      console.warn = warn
    }
  })
})

test('googleProvider: closing sign-up closes it for Google', () => {
  expect(googleProvider({ clientId: ['web'], clientSecret: 's' }, { signUp: false })).toEqual({
    clientId: ['web'],
    clientSecret: 's',
    disableImplicitSignUp: true,
    prompt: 'select_account',
  })
})

describe('freeUsername', () => {
  test('takes the name when nobody has it', async () => {
    expect(await freeUsername('Marie Dupont', null, async () => new Set(), 'member')).toBe('marie.dupont')
  })
  test('adds a number when the name is taken', async () => {
    expect(await freeUsername('Marie Dupont', null, async () => new Set(['marie.dupont']), 'member')).toMatch(/^marie\.dupont\d{4}$/)
  })
  test('still gives a name when every candidate is taken', async () => {
    const taken = mock(async (candidates: string[]) => new Set(candidates))
    expect(await freeUsername('Marie', null, taken, 'member')).toMatch(/^marie[0-9a-f]{12}$/)
    expect(taken).toHaveBeenCalledTimes(3)
  })
})

describe('Google joining an account', () => {
  const adapter = (providers: string[], image: string | null = null) => ({
    findAccounts: mock(async () => providers.map((providerId) => ({ providerId }))),
    deleteUserSessions: mock(async () => undefined),
    listSessions: mock(async () => [{ token: 'mine' }, { token: 'other1' }, { token: 'other2' }]),
    deleteSessions: mock(async () => undefined),
    findUserById: mock(async () => ({ image })),
    updateUser: mock(async () => undefined),
  })
  const token = (claims: object) => `h.${btoa(JSON.stringify(claims)).replaceAll('=', '')}.s`
  const PIC = 'https://lh3.googleusercontent.com/a/abc'

  test('takes Google’s picture only when the account has none', async () => {
    const bare = adapter(['credential', 'google'])
    await afterAccountSaved({ providerId: 'google', userId: 'u1', idToken: token({ picture: PIC }) }, bare)
    expect(bare.updateUser).toHaveBeenCalledWith('u1', { image: PIC })
    const pictured = adapter(['credential', 'google'], 'https://example.com/me.png')
    await afterAccountSaved({ providerId: 'google', userId: 'u1', idToken: token({ picture: PIC }) }, pictured)
    expect(pictured.updateUser).not.toHaveBeenCalled()
  })

  test('reads only an https picture of a sane length', () => {
    expect(pictureFromIdToken(token({ picture: PIC }))).toBe(PIC)
    expect(pictureFromIdToken(token({ picture: 'javascript:alert(1)' }))).toBeNull()
    expect(pictureFromIdToken(token({ picture: `https://example.com/${'a'.repeat(2000)}` }))).toBeNull()
    expect(pictureFromIdToken('not-a-token')).toBeNull()
    expect(pictureFromIdToken(null)).toBeNull()
  })

  test('connecting Google while signed in keeps that session and ends the others', async () => {
    const linked = adapter(['credential', 'google'])
    expect(await afterAccountSaved({ providerId: 'google', userId: 'u1' }, linked, 'mine')).toBe(true)
    expect(linked.deleteSessions).toHaveBeenCalledWith(['other1', 'other2'])
    expect(linked.deleteUserSessions).not.toHaveBeenCalled()
  })

  test('signs the account out everywhere; leaves new Google accounts and passwords alone', async () => {
    const joined = adapter(['credential', 'google'])
    expect(await afterAccountSaved({ providerId: 'google', userId: 'u1' }, joined)).toBe(true)
    expect(joined.deleteUserSessions).toHaveBeenCalledWith('u1')
    const fresh = adapter(['google'])
    expect(await afterAccountSaved({ providerId: 'google', userId: 'u1' }, fresh)).toBe(false)
    expect(fresh.deleteUserSessions).not.toHaveBeenCalled()
    const password = adapter(['credential'])
    expect(await afterAccountSaved({ providerId: 'credential', userId: 'u1' }, password)).toBe(false)
    expect(password.findAccounts).not.toHaveBeenCalled()
  })
})

test('asPublicRequest gives the site its https back, and leaves other hosts alone', () => {
  const site = 'https://app.example.com'
  expect(asPublicRequest(new Request('http://app.example.com/api/auth/callback/google?code=1'), site).url).toBe(
    'https://app.example.com/api/auth/callback/google?code=1',
  )
  const local = new Request('http://localhost:5173/x')
  expect(asPublicRequest(local, site)).toBe(local)
})

test('toAuthUser: the display username, no placeholder email, no suspended account', () => {
  const { roleOf } = defineRoles({ roles: ['user', 'admin'], defaultRole: 'user', adminPanel: ['admin'] })
  const user = { id: '1', name: 'Ana', email: 'x@users.invalid', username: 'ana', displayUsername: 'Ana', role: 'user,admin' }
  expect(toAuthUser(user, roleOf)).toEqual({ id: '1', username: 'Ana', name: 'Ana', email: null, image: null, role: 'admin' })
  expect(toAuthUser({ ...user, banned: true }, roleOf)).toBeNull()
  expect(toAuthUser(null, roleOf)).toBeNull()
})

describe('standardAuthOptions: passkey origins', () => {
  const base = {
    appName: 'Example',
    siteUrl: 'https://app.example.com',
    settings: authSettings({ E2E: '1' }),
    database: undefined,
    admin: { defaultRole: 'user', adminRoles: ['admin'] },
    takenUsernames: async () => new Set<string>(),
    usernameFallback: 'member',
  }
  const passkeyOptions = (options: ReturnType<typeof standardAuthOptions>) => {
    const plugin = options.plugins.find((p) => p.id === 'passkey')
    return plugin && 'options' in plugin ? (plugin.options as { origin?: unknown }) : null
  }

  test("'listed' (the default): the site, local origins and the Android app", () => {
    const options = standardAuthOptions({ ...base, localOrigins: ['http://localhost:5173'], androidCertSha256: ['00:01'] })
    expect(passkeyOptions(options)?.origin).toEqual(['https://app.example.com', 'http://localhost:5173', 'android:apk-key-hash:AAE'])
  })

  test("'request': no list, so Better Auth uses the request's own (allowed) origin", () => {
    const options = standardAuthOptions({ ...base, passkeyOrigin: 'request' })
    expect(passkeyOptions(options)).not.toBeNull()
    expect(passkeyOptions(options)?.origin).toBeUndefined()
  })

  test("'request' refuses the Android app's certificates and local origins", () => {
    expect(() => standardAuthOptions({ ...base, passkeyOrigin: 'request', androidCertSha256: ['00:01'] })).toThrow('passkeyOrigin')
    expect(() => standardAuthOptions({ ...base, passkeyOrigin: 'request', localOrigins: ['http://localhost:5173'] })).toThrow(
      'passkeyOrigin',
    )
  })
})
