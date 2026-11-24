import { describe, expect, mock, test } from 'bun:test'
import { createMobileAuth, type SecureStorage } from './expo'

const ORIGIN = 'https://app.example.com'
type User = { id: string }

function memoryStorage(initial: Record<string, string> = {}): SecureStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItemAsync: async (key) => data.get(key) ?? null,
    setItemAsync: async (key, value) => void data.set(key, value),
    deleteItemAsync: async (key) => void data.delete(key),
  }
}

type Route = (body: unknown, headers: Headers) => Response
function fakeFetch(routes: Record<string, Route>) {
  const calls: { path: string; body: unknown; headers: Headers }[] = []
  const fn = mock(async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input).replace(`${ORIGIN}/api/auth`, '')
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    const headers = new Headers(init?.headers)
    calls.push({ path, body, headers })
    const route = routes[path]
    return route ? route(body, headers) : new Response('{}', { status: 404 })
  })
  return { fetch: fn as unknown as typeof fetch, calls }
}

const withToken = (token: string) => new Response('{}', { status: 200, headers: { 'set-auth-token': token } })

describe('createMobileAuth', () => {
  test('restore: no token → out; a live token → in; a dead one is dropped', async () => {
    const out = createMobileAuth<User>({ origin: ORIGIN, storage: memoryStorage(), tokenKey: 'k', fetchMe: async () => ({ id: 'x' }) })
    await out.restore()
    expect(out.getSession()).toEqual({ status: 'out' })

    const live = createMobileAuth<User>({
      origin: ORIGIN,
      storage: memoryStorage({ k: 't1' }),
      tokenKey: 'k',
      fetchMe: async () => ({ id: 'u1' }),
    })
    await live.restore()
    expect(live.getSession()).toEqual({ status: 'in', user: { id: 'u1' } })
    expect(live.authHeaders()).toEqual({ authorization: 'Bearer t1' })

    const storage = memoryStorage({ k: 'dead' })
    const dead = createMobileAuth<User>({
      origin: ORIGIN,
      storage,
      tokenKey: 'k',
      fetchMe: () => Promise.reject(Object.assign(new Error('no'), { code: 'UNAUTHORIZED' })),
    })
    await dead.restore()
    expect(dead.getSession()).toEqual({ status: 'out' })
    expect(storage.data.has('k')).toBe(false)
  })

  test('signIn by username or email, keeps the token, tells subscribers', async () => {
    const { fetch, calls } = fakeFetch({ '/sign-in/username': () => withToken('t2'), '/sign-in/email': () => withToken('t3') })
    const storage = memoryStorage()
    const auth = createMobileAuth<User>({ origin: ORIGIN, storage, tokenKey: 'k', fetchMe: async () => ({ id: 'u1' }), fetch })
    const seen = mock(() => {})
    auth.subscribe(seen)
    expect(await auth.signIn(' Ana ', 'pw')).toEqual({ ok: true })
    expect(calls[0]).toMatchObject({ path: '/sign-in/username', body: { username: 'ana', password: 'pw' } })
    expect(calls[0]?.headers.get('origin')).toBe(ORIGIN)
    expect(storage.data.get('k')).toBe('t2')
    expect(seen).toHaveBeenCalled()
    expect(await auth.signIn('ana@example.com', 'pw')).toEqual({ ok: true })
    expect(calls[1]?.path).toBe('/sign-in/email')
  })

  test('failures come back as codes', async () => {
    const { fetch } = fakeFetch({
      '/sign-in/username': () => new Response(JSON.stringify({ code: 'INVALID_USERNAME_OR_PASSWORD' }), { status: 401 }),
      '/sign-in/email': () => new Response('{}', { status: 429 }),
    })
    const auth = createMobileAuth<User>({
      origin: ORIGIN,
      storage: memoryStorage(),
      tokenKey: 'k',
      fetchMe: async () => ({ id: 'u1' }),
      fetch,
    })
    expect(await auth.signIn('ana', 'pw')).toEqual({ ok: false, code: 'INVALID_USERNAME_OR_PASSWORD' })
    expect(await auth.signIn('ana@example.com', 'pw')).toEqual({ ok: false, code: 'TOO_MANY_REQUESTS' })
    expect(await auth.signIn('x@users.invalid', 'pw')).toEqual({ ok: false, code: 'INVALID_EMAIL_OR_PASSWORD' })
    expect(await auth.signIn('', 'pw')).toEqual({ ok: false, code: 'MISSING_FIELDS' })
    const offline = createMobileAuth<User>({
      origin: ORIGIN,
      storage: memoryStorage(),
      tokenKey: 'k',
      fetchMe: async () => ({ id: 'u1' }),
      fetch: (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch,
    })
    expect(await offline.signIn('ana', 'pw')).toEqual({ ok: false, code: 'NETWORK' })
  })

  test('signUp without an email uses a placeholder; Google sends the ID token', async () => {
    const { fetch, calls } = fakeFetch({ '/sign-up/email': () => withToken('t4'), '/sign-in/social': () => withToken('t5') })
    const auth = createMobileAuth<User>({
      origin: ORIGIN,
      storage: memoryStorage(),
      tokenKey: 'k',
      fetchMe: async () => ({ id: 'u1' }),
      fetch,
    })
    expect(await auth.signUp({ username: 'Ana', password: 'pw' })).toEqual({ ok: true })
    expect(calls[0]?.body).toMatchObject({ name: 'ana', username: 'ana', email: expect.stringMatching(/@users\.invalid$/) })
    expect(await auth.signInWithGoogle('id-token', { nonce: 'n' })).toEqual({ ok: true })
    expect(calls[1]?.body).toEqual({ provider: 'google', disableRedirect: true, idToken: { token: 'id-token', nonce: 'n' } })
  })

  test('Google: a refused join is ACCOUNT_NOT_LINKED; linkGoogle connects with the Bearer session', async () => {
    const { fetch, calls } = fakeFetch({
      '/sign-in/social': () => new Response(JSON.stringify({ code: 'OAUTH_LINK_ERROR', message: 'account not linked' }), { status: 401 }),
      '/link-social': () => new Response(JSON.stringify({ status: true, redirect: false, url: '' })),
    })
    const storage = memoryStorage({ k: 't8' })
    const auth = createMobileAuth<User>({ origin: ORIGIN, storage, tokenKey: 'k', fetchMe: async () => ({ id: 'u1' }), fetch })
    expect(await auth.signInWithGoogle('id-token')).toEqual({ ok: false, code: 'ACCOUNT_NOT_LINKED' })
    expect(await auth.linkGoogle('id-token')).toEqual({ ok: false, code: 'NO_SESSION' })
    await auth.restore()
    expect(await auth.linkGoogle('id-token')).toEqual({ ok: true })
    const link = calls.find((call) => call.path === '/link-social')
    expect(link?.headers.get('authorization')).toBe('Bearer t8')
    expect(link?.body).toEqual({ provider: 'google', disableRedirect: true, idToken: { token: 'id-token' } })
  })

  test('passkeys: sign in with the assertion; a cancelled prompt is CANCELLED', async () => {
    const { fetch, calls } = fakeFetch({
      '/passkey/generate-authenticate-options': () => new Response(JSON.stringify({ challenge: 'c' })),
      '/passkey/verify-authentication': () => withToken('t6'),
    })
    const auth = createMobileAuth<User>({
      origin: ORIGIN,
      storage: memoryStorage(),
      tokenKey: 'k',
      fetchMe: async () => ({ id: 'u1' }),
      fetch,
    })
    const get = mock(async () => ({ id: 'cred' }))
    expect(await auth.signInWithPasskey({ get, create: async () => null })).toEqual({ ok: true })
    expect(get).toHaveBeenCalledWith({ challenge: 'c' })
    expect(calls[1]?.body).toEqual({ response: { id: 'cred' } })
    expect(await auth.signInWithPasskey({ get: async () => null, create: async () => null })).toEqual({ ok: false, code: 'CANCELLED' })
  })

  test('signOut ends the server session and forgets the token', async () => {
    const { fetch, calls } = fakeFetch({ '/sign-out': () => new Response('{}') })
    const storage = memoryStorage({ k: 't7' })
    const auth = createMobileAuth<User>({ origin: ORIGIN, storage, tokenKey: 'k', fetchMe: async () => ({ id: 'u1' }), fetch })
    await auth.restore()
    await auth.signOut()
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer t7')
    expect(storage.data.has('k')).toBe(false)
    expect(auth.getSession()).toEqual({ status: 'out' })
  })
})
