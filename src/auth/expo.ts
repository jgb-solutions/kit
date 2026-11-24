/**
 * Sign-in for the mobile apps (Expo), against the website's Better Auth (`/api/auth`, with the bearer
 * plugin): the session comes back as a token, kept in the phone's secure storage and sent as
 * `Authorization: Bearer` with every RPC call. The server turns it into the same session as the
 * website's cookie.
 *
 * No dependencies: the app passes in what is native, so the same code runs in tests.
 *
 *   import * as SecureStore from 'expo-secure-store'
 *   import * as Passkeys from 'react-native-passkeys'
 *   export const auth = createMobileAuth({ origin: SITE_URL, storage: SecureStore, tokenKey: 'myapp.session', fetchMe })
 *   const session = useSyncExternalStore(auth.subscribe, auth.getSession)  // in a component
 *   await auth.signIn('maria', password)
 *   await auth.signInWithGoogle(idToken)     // from the app's Google Sign-In SDK
 *   await auth.signInWithPasskey(Passkeys)
 *   const rpc = createORPCClient(new RPCLink({ …, headers: auth.authHeaders }))
 *
 * Failures come back as codes (Better Auth's, such as INVALID_USERNAME_OR_PASSWORD; the kit's
 * ACCOUNT_NOT_LINKED and GOOGLE_ALREADY_LINKED from kit/auth/rules; or NETWORK, TOO_MANY_REQUESTS,
 * CANCELLED, NO_TOKEN): the app words them.
 */
import { authErrorCode, isPlaceholderEmail, placeholderEmail } from './rules'

/** What the app passes as `storage`: `expo-secure-store` has exactly this shape. */
export type SecureStorage = {
  getItemAsync(key: string): Promise<string | null>
  setItemAsync(key: string, value: string): Promise<void>
  deleteItemAsync(key: string): Promise<void>
}

/** What the passkey calls need: `react-native-passkeys` has this shape (its methods take the options Better Auth sends). */
export type PasskeysModule = {
  get(request: unknown): Promise<unknown>
  create(request: unknown): Promise<unknown>
}

export type MobileSession<U> = { status: 'loading' } | { status: 'out' } | { status: 'in'; user: U }

export type AuthResult = { ok: true } | { ok: false; code: string }

export type MobileAuthConfig<U> = {
  /** The website's origin, `https://…`: Better Auth checks sign-ins come from it. */
  origin: string
  storage: SecureStorage
  /** Where the token is kept in secure storage. */
  tokenKey: string
  /** The signed-in person, from the app's own RPC call; it throws `{ code: 'UNAUTHORIZED' }` for a dead token. */
  fetchMe: () => Promise<U>
  /** Runs after each sign-in (`firstTime`) and each launch with a saved session: syncing what the phone holds. */
  onSignedIn?: (firstTime: boolean) => Promise<void>
  /** For tests. */
  fetch?: typeof fetch
}

function codeOf(body: unknown, fallback: string): string {
  return authErrorCode(body) || fallback
}

function isUnauthorized(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'UNAUTHORIZED'
}

export function createMobileAuth<U>(config: MobileAuthConfig<U>) {
  const doFetch = config.fetch ?? fetch
  let token: string | null = null
  let session: MobileSession<U> = { status: 'loading' }
  const listeners = new Set<() => void>()

  function set(next: MobileSession<U>) {
    session = next
    for (const listener of listeners) listener()
  }

  async function forget() {
    token = null
    await config.storage.deleteItemAsync(config.tokenKey).catch(() => {})
    set({ status: 'out' })
  }

  /** The header the RPC client adds: the session's token, when signed in. */
  function authHeaders(): Record<string, string> {
    return token ? { authorization: `Bearer ${token}` } : {}
  }

  /** A call to Better Auth, the way the website's server makes one; the passkey challenge rides on a cookie. */
  async function call(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ response: Response; body: unknown }> {
    const response = await doFetch(`${config.origin}/api/auth${path}`, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: { 'content-type': 'application/json', origin: config.origin, ...authHeaders() },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    })
    return { response, body: await response.json().catch(() => null) }
  }

  /** Starts a session from a token Better Auth gave. */
  async function start(newToken: string, firstTime: boolean): Promise<AuthResult> {
    token = newToken
    await config.storage.setItemAsync(config.tokenKey, newToken)
    try {
      set({ status: 'in', user: await config.fetchMe() })
    } catch {
      await forget()
      return { ok: false, code: 'NO_SESSION' }
    }
    await config.onSignedIn?.(firstTime).catch(() => {})
    return { ok: true }
  }

  /** POSTs a sign-in or sign-up and starts the session from the `set-auth-token` header it answers with. */
  async function signInWith(path: string, body: unknown): Promise<AuthResult> {
    try {
      const { response, body: answer } = await call(path, { method: 'POST', body })
      if (response.status === 429) return { ok: false, code: 'TOO_MANY_REQUESTS' }
      const newToken = response.headers.get('set-auth-token')
      if (response.ok && newToken) return start(newToken, true)
      return { ok: false, code: codeOf(answer, response.ok ? 'NO_TOKEN' : String(response.status)) }
    } catch {
      return { ok: false, code: 'NETWORK' }
    }
  }

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSession: (): MobileSession<U> => session,
    authHeaders,

    /** At launch: the saved token, checked with the server. A dead token is dropped; offline, the app shows signed out. */
    async restore(): Promise<void> {
      token = await config.storage.getItemAsync(config.tokenKey).catch(() => null)
      if (!token) return set({ status: 'out' })
      try {
        set({ status: 'in', user: await config.fetchMe() })
        void config.onSignedIn?.(false).catch(() => {})
      } catch (error) {
        if (isUnauthorized(error)) return forget()
        set({ status: 'out' })
      }
    },

    /** A username or an email address, and the password. */
    signIn(login: string, password: string): Promise<AuthResult> {
      const value = login.trim().toLowerCase()
      if (!value || !password) return Promise.resolve({ ok: false, code: 'MISSING_FIELDS' })
      if (value.includes('@') && isPlaceholderEmail(value)) return Promise.resolve({ ok: false, code: 'INVALID_EMAIL_OR_PASSWORD' })
      return value.includes('@')
        ? signInWith('/sign-in/email', { email: value, password })
        : signInWith('/sign-in/username', { username: value, password })
    },

    /** A new account. Without an email address, the placeholder the website uses (never shown or mailed). */
    signUp(input: { username: string; password: string; email?: string; name?: string }): Promise<AuthResult> {
      const username = input.username.trim().toLowerCase()
      return signInWith('/sign-up/email', {
        name: input.name?.trim() || username,
        username,
        email: input.email?.trim() || placeholderEmail(),
        password: input.password,
      })
    },

    /**
     * "Continue with Google" with the ID token from the app's Google Sign-In SDK. Better Auth checks it
     * with Google (its audience must be one of GOOGLE_CLIENT_ID or GOOGLE_MOBILE_CLIENT_IDS) and signs
     * in, links or creates the account by the server's rules.
     */
    signInWithGoogle(idToken: string, options: { nonce?: string } = {}): Promise<AuthResult> {
      return signInWith('/sign-in/social', {
        provider: 'google',
        disableRedirect: true,
        idToken: { token: idToken, ...(options.nonce ? { nonce: options.nonce } : {}) },
      })
    },

    /**
     * Connects Google to the signed-in account (its account page), with an ID token from the app's
     * Google Sign-In SDK: afterwards "Continue with Google" signs into this account. The Google address
     * may differ from the account's. Other sessions of the account end; this one stays.
     */
    async linkGoogle(idToken: string, options: { nonce?: string } = {}): Promise<AuthResult> {
      if (!token) return { ok: false, code: 'NO_SESSION' }
      try {
        const { response, body } = await call('/link-social', {
          method: 'POST',
          body: {
            provider: 'google',
            disableRedirect: true,
            idToken: { token: idToken, ...(options.nonce ? { nonce: options.nonce } : {}) },
          },
        })
        if (response.status === 429) return { ok: false, code: 'TOO_MANY_REQUESTS' }
        return response.ok ? { ok: true } : { ok: false, code: codeOf(body, String(response.status)) }
      } catch {
        return { ok: false, code: 'NETWORK' }
      }
    },

    /** Signs in with a passkey saved on the phone (or in the person's Google or Apple account). */
    async signInWithPasskey(passkeys: PasskeysModule): Promise<AuthResult> {
      try {
        const options = await call('/passkey/generate-authenticate-options')
        if (!options.response.ok) return { ok: false, code: codeOf(options.body, String(options.response.status)) }
        const assertion = await passkeys.get(options.body)
        if (!assertion) return { ok: false, code: 'CANCELLED' }
        return signInWith('/passkey/verify-authentication', { response: assertion })
      } catch {
        return { ok: false, code: 'CANCELLED' }
      }
    },

    /** Adds a passkey to the signed-in account: the way back in if the password is forgotten. */
    async addPasskey(passkeys: PasskeysModule, name: string): Promise<AuthResult> {
      try {
        const options = await call('/passkey/generate-register-options')
        if (!options.response.ok) return { ok: false, code: codeOf(options.body, String(options.response.status)) }
        const credential = await passkeys.create(options.body)
        if (!credential) return { ok: false, code: 'CANCELLED' }
        const verified = await call('/passkey/verify-registration', { method: 'POST', body: { response: credential, name } })
        return verified.response.ok ? { ok: true } : { ok: false, code: codeOf(verified.body, String(verified.response.status)) }
      } catch {
        return { ok: false, code: 'CANCELLED' }
      }
    },

    /** Ends the session on the server too, then forgets it. */
    async signOut(): Promise<void> {
      if (token) await call('/sign-out', { method: 'POST' }).catch(() => {})
      await forget()
    },

    /** Forgets the session without calling the server: after the account was deleted. */
    forget,
  }
}

export type MobileAuth<U> = ReturnType<typeof createMobileAuth<U>>
