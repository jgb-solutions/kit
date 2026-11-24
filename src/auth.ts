/**
 * Better Auth, set up the same way in every app: pieces for the server, and `standardAuthOptions`, a
 * preset that puts them together. The app keeps what is its own: its name and address, database and
 * schema, roles and permissions, texts, and what happens to its data when an account is deleted.
 *
 * Sign-in is a username or email with a password, passkeys (also the way back into an account whose
 * password is forgotten: no email is ever sent), and "Continue with Google" when its keys are set.
 * The website signs in with a cookie, the mobile app with `Authorization: Bearer` (the bearer plugin):
 * both reach the same session.
 *
 *   import { authSettings, standardAuthOptions } from '@jgb-solutions/kit/auth'
 *   const auth = betterAuth(standardAuthOptions({ appName, siteUrl, settings: authSettings(env), … }))
 *
 * Needs `better-auth` and `@better-auth/passkey` (optional peer dependencies of the kit).
 */
import { passkey } from '@better-auth/passkey'
import type { BetterAuthOptions, BetterAuthPlugin, BetterAuthRateLimitStorage } from 'better-auth'
import { createAuthMiddleware } from 'better-auth/api'
import { admin, type AdminOptions } from 'better-auth/plugins/admin'
import { bearer } from 'better-auth/plugins/bearer'
import { username } from 'better-auth/plugins/username'
import { type AuthUser, isPlaceholderEmail, PASSWORD, USERNAME, usernameCandidates, usernameFromName } from './auth/rules'

type Env = Record<string, string | undefined>

/** The secret E2E test servers use when BETTER_AUTH_SECRET isn't set. Never accepted outside E2E. */
const E2E_SECRET = 'e2e-only-secret-never-used-in-production-0000'

export type GoogleSettings = {
  /** The web client first, then the mobile apps' clients (their ID tokens name them as audience). */
  clientId: string[]
  clientSecret: string
}

export type AuthSettings = {
  secret: string
  /** Public sign-up: on unless SIGN_UP=off. Existing accounts always sign in. */
  signUp: boolean
  /** Rate limits: always on, except on the E2E test server (every test comes from 127.0.0.1). */
  rateLimit: boolean
  /** Addresses whose new accounts start as admin when created with a confirmed address (Google), lower-cased. */
  adminEmails: string[]
  /** "Continue with Google": on only when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are both set. */
  google: GoogleSettings | null
}

/**
 * Sign-in settings from the environment, the same on every host: BETTER_AUTH_SECRET, SIGN_UP,
 * ADMIN_EMAILS, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_MOBILE_CLIENT_IDS (comma-separated:
 * the Android and iOS clients). E2E=1 marks the E2E test server: its stand-in secret and its rate
 * limits off are refused when NODE_ENV is production, so a stray E2E=1 can't start production with a
 * public secret. Throws without a secret.
 */
export function authSettings(env: Env): AuthSettings {
  const e2e = env.E2E === '1'
  if (e2e && env.NODE_ENV === 'production') throw new Error('E2E=1 is set in production: remove it.')
  const secret = env.BETTER_AUTH_SECRET || (e2e ? E2E_SECRET : '')
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not set.')
  const list = (value: string | undefined) =>
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  const web = env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim()
  return {
    secret,
    signUp: env.SIGN_UP !== 'off',
    rateLimit: !e2e,
    adminEmails: list(env.ADMIN_EMAILS).map((email) => email.toLowerCase()),
    google: web && clientSecret ? { clientId: [web, ...list(env.GOOGLE_MOBILE_CLIENT_IDS)], clientSecret } : null,
  }
}

/**
 * The role a new account starts with: `adminRole` for an address in ADMIN_EMAILS, but only when the
 * address is confirmed (Google sets `emailVerified` from its `email_verified`; a sign-up with an email
 * address never does, since no email is sent). Otherwise anyone could sign up first with an admin's
 * address and take the role. Else `defaultRole`.
 */
export function roleForNewUser<R extends string>(
  user: { email: string; emailVerified?: unknown },
  adminEmails: readonly string[],
  defaultRole: R,
  adminRole: R,
): R {
  return user.emailVerified === true && adminEmails.includes(user.email.trim().toLowerCase()) ? adminRole : defaultRole
}

/**
 * Better Auth's `baseURL`: the request's own host, but only the site's or a local one; anything else
 * falls back to the site. A forged Host header can't choose the passkeys' relying party or the
 * address in a callback.
 */
export function trustedBaseUrl(siteUrl: string, localHosts: readonly string[] = ['localhost:*', '127.0.0.1:*']) {
  return { allowedHosts: [new URL(siteUrl).host, ...localHosts], protocol: 'auto' as const, fallback: siteUrl }
}

/** An Android signing certificate's SHA-256 (`AB:CD:…`) as WebAuthn reports it: `android:apk-key-hash:<base64url>`. */
export function androidOrigin(sha256: string): string {
  const bytes = sha256
    .split(':')
    .map((pair) => String.fromCharCode(Number.parseInt(pair, 16)))
    .join('')
  return `android:apk-key-hash:${btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

/**
 * The Digital Asset Links statement for `/.well-known/assetlinks.json`: the Android app opens the
 * site's links and uses its passkeys. The package name and certificates are the app's own.
 */
export function assetLinks(packageName: string, sha256Fingerprints: readonly string[]) {
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls', 'delegate_permission/common.get_login_creds'],
      target: { namespace: 'android_app', package_name: packageName, sha256_cert_fingerprints: [...sha256Fingerprints] },
    },
  ]
}

/**
 * Where passkeys may be used: the site, the local origins development and E2E use (a localhost page
 * can never use the real site's passkeys), and the Android app's certificates.
 */
export function passkeyOrigins(siteUrl: string, options: { local?: readonly string[]; androidCertSha256?: readonly string[] } = {}) {
  return [new URL(siteUrl).origin, ...(options.local ?? []), ...(options.androidCertSha256 ?? []).map(androidOrigin)]
}

/** Per-path limits on top of Better Auth's default (60 requests a minute): sign-in and sign-up attempts. */
export const RATE_LIMIT_RULES = {
  '/sign-in/email': { window: 60, max: 10 },
  '/sign-in/username': { window: 60, max: 10 },
  '/sign-up/email': { window: 60 * 60, max: 5 },
  '/sign-in/social': { window: 60, max: 10 },
  '/callback/*': { window: 60, max: 10 },
  '/passkey/*': { window: 60, max: 20 },
  '/change-password': { window: 60, max: 5 },
  '/set-password': { window: 60, max: 5 },
  '/delete-user': { window: 60, max: 5 },
} as const

/** A counter store: Redis, Dragonfly, Workers KV with a Durable Object, or anything with an atomic increment. */
export type CounterStore = {
  /** Adds 1 to `key` and returns the new count; a new key expires after `ttlSeconds`. */
  incr(key: string, ttlSeconds: number): Promise<number>
}

/**
 * Rate-limit counts in a counter store (one increment per attempt, on a key per fixed window), never
 * as a database row per attempt. When the store can't answer, the attempt is let through and logged:
 * the password hash's cost still slows guessing, and sign-in never goes down with the cache.
 */
export function counterRateLimit(store: () => CounterStore, now: () => number = Date.now): BetterAuthRateLimitStorage {
  return {
    async consume(key, rule) {
      const windowMs = rule.window * 1000
      const slot = Math.floor(now() / windowMs)
      let count: number
      try {
        count = await store().incr(`auth-limit:${key}:${slot}`, rule.window)
      } catch (error) {
        console.warn('auth rate limit: store unavailable, letting the attempt through', error)
        return { allowed: true, retryAfter: null }
      }
      if (count <= rule.max) return { allowed: true, retryAfter: null }
      return { allowed: false, retryAfter: Math.max(1, Math.ceil(((slot + 1) * windowMs - now()) / 1000)) }
    },
  }
}

/**
 * Account linking, "merge only confirmed" (owner, 2026-11-24):
 *
 * - **Signing in with Google** joins an existing account with the same address only when both
 *   addresses are confirmed: Google's (`email_verified`; Google isn't a trusted provider) and the
 *   account's own. The app never sends email, so an account's address is confirmed only when it was
 *   made with Google or by an admin. Otherwise Better Auth refuses (`ACCOUNT_NOT_LINKED` after
 *   `authErrorCode`): someone could have signed up first with another person's address and a password
 *   they know. The person signs in with their password and connects Google from their account page.
 * - **Connecting Google while signed in** (Better Auth's `linkSocial`) proves both sides, so the Google
 *   address may differ from the account's: accounts made with a username have a placeholder address
 *   that could never match.
 *
 * The account keeps its name and picture (afterAccountSaved adds Google's picture if it had none).
 */
export const CONFIRMED_ACCOUNT_LINKING = {
  enabled: true,
  trustedProviders: [] as string[],
  requireLocalEmailVerified: true,
  allowDifferentEmails: true,
  updateUserInfoOnLink: false,
}

/** Better Auth's Google provider from the settings. Closing sign-up closes it for Google too. */
export function googleProvider(google: GoogleSettings, options: { signUp: boolean }) {
  return {
    clientId: google.clientId,
    clientSecret: google.clientSecret,
    disableImplicitSignUp: !options.signUp,
    prompt: 'select_account' as const,
  }
}

/**
 * The first free username for a new account made without one (Google), from its name. `taken` answers
 * which of the candidates are used (one query per round). After three rounds, a random one.
 */
export async function freeUsername(
  name: string | null | undefined,
  email: string | null | undefined,
  taken: (candidates: string[]) => Promise<ReadonlySet<string>>,
  fallback: string,
): Promise<string> {
  const base = usernameFromName(name, email, fallback)
  for (let round = 0; round < 3; round++) {
    const candidates = usernameCandidates(base).slice(round === 0 ? 0 : 1)
    const used = await taken(candidates)
    const free = candidates.find((candidate) => !used.has(candidate))
    if (free) return free
  }
  return `${base.slice(0, USERNAME.max - 13)}${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`
}

/** The picture in a Google ID token (already verified by Better Auth), when it is an https address of at most 2,000 characters. */
export function pictureFromIdToken(idToken: string | null | undefined): string | null {
  const payload = idToken?.split('.')[1]
  if (!payload) return null
  try {
    const claims: unknown = JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/')))
    const picture = claims && typeof claims === 'object' && 'picture' in claims ? claims.picture : null
    return typeof picture === 'string' && picture.startsWith('https://') && picture.length <= 2000 ? picture : null
  } catch {
    return null
  }
}

/** The part of Better Auth's internal adapter `afterAccountSaved` uses. */
export type AccountAdapter = {
  findAccounts(userId: string): Promise<{ providerId: string }[]>
  deleteUserSessions(userId: string): Promise<unknown>
  listSessions(userId: string): Promise<{ token: string }[]>
  deleteSessions(tokens: string[]): Promise<unknown>
  findUserById(userId: string): Promise<{ image?: string | null | undefined } | null>
  updateUser(userId: string, data: { image: string }): Promise<unknown>
}

/**
 * After an account row is saved: when it is Google joining an account that already had another way
 * in, the account's other sessions end (a session someone else held doesn't carry on), and the account
 * takes Google's picture if it had none. `keepSessionToken` is the session of the person connecting
 * Google from their account page, which stays; a Google sign-in that joins an account ends them all
 * and gets its own right after. Returns whether it was such a join.
 */
export async function afterAccountSaved(
  account: { providerId: string; userId: string; idToken?: string | null | undefined },
  adapter: AccountAdapter,
  keepSessionToken?: string | null,
): Promise<boolean> {
  if (account.providerId !== 'google') return false
  const accounts = await adapter.findAccounts(account.userId)
  if (!accounts.some((other) => other.providerId !== 'google')) return false
  if (keepSessionToken) {
    const others = (await adapter.listSessions(account.userId))
      .map((session) => session.token)
      .filter((token) => token !== keepSessionToken)
    if (others.length) await adapter.deleteSessions(others)
  } else {
    await adapter.deleteUserSessions(account.userId)
  }
  const picture = pictureFromIdToken(account.idToken)
  if (picture) {
    const user = await adapter.findUserById(account.userId)
    if (user && !user.image) await adapter.updateUser(account.userId, { image: picture })
  }
  return true
}

/** The part of Better Auth's endpoint context the account hook reads. */
type AccountHookContext = {
  context: {
    internalAdapter: AccountAdapter
    session?: { session: { token: string } } | null
    authCookies: { sessionToken: { name: string } }
    secret: string
  }
  getSignedCookie(name: string, secret: string): Promise<string | null | false | undefined>
}

/**
 * The session of the person behind the request, when there is one: set on `linkSocial` (signed in),
 * read from the session cookie on the OAuth callback that completes it. Null on a sign-in.
 */
async function currentSessionToken(ctx: AccountHookContext): Promise<string | null> {
  const token =
    ctx.context.session?.session.token ??
    (await ctx.getSignedCookie(ctx.context.authCookies.sessionToken.name, ctx.context.secret).catch(() => null))
  return typeof token === 'string' && token ? token : null
}

/**
 * A readable "signed in" cookie (no secret in it), set with every new session and cleared at sign-out
 * and account deletion. Cached public pages read it to decide whether to ask for the account. It may
 * outlive the session; the account call then answers no user and the page clears it.
 */
export function signedInFlagHook(name: string, maxAgeSeconds = 365 * 24 * 60 * 60) {
  return createAuthMiddleware(async (ctx) => {
    const options = { path: '/', sameSite: 'lax' as const, secure: ctx.context.authCookies.sessionToken.attributes.secure === true }
    if (ctx.context.newSession) ctx.setCookie(name, '1', { ...options, maxAge: maxAgeSeconds })
    else if (ctx.path === '/sign-out' || ctx.path === '/delete-user') ctx.setCookie(name, '', { ...options, maxAge: 0 })
  })
}

/**
 * The request as visitors made it. Behind a tunnel or proxy that ends HTTPS, a request for the site
 * arrives as `http://`; Better Auth builds its own address from the request, and Google refuses a
 * token exchange whose redirect address changed ("redirect_uri_mismatch"). Requests for the site get
 * its protocol back; other hosts stay as they are.
 */
export function asPublicRequest(request: Request, siteUrl: string): Request {
  const url = new URL(request.url)
  const site = new URL(siteUrl)
  if (url.host !== site.host || url.protocol === site.protocol) return request
  url.protocol = site.protocol
  return new Request(url, request)
}

/** How passwords are hashed: Bun's argon2id on Bun (`@jgb-solutions/kit/auth/bun`), Better Auth's scrypt elsewhere. */
export type PasswordHasher = {
  hash(password: string): Promise<string>
  verify(input: { hash: string; password: string }): Promise<boolean>
}

/** Better Auth's session user, with the fields the username and admin plugins add. */
export type SessionUser = {
  id: string
  name: string
  email: string
  image?: string | null | undefined
  username?: string | null | undefined
  displayUsername?: string | null | undefined
  role?: string | null | undefined
  banned?: boolean | null | undefined
}

/** The signed-in person from a session's user, or null for none or a suspended account. */
export function toAuthUser<Role extends string>(
  user: SessionUser | null | undefined,
  roleOf: (stored: string | null | undefined) => Role,
): AuthUser<Role> | null {
  if (!user || user.banned) return null
  return {
    id: user.id,
    username: user.displayUsername || user.username || user.name,
    name: user.name,
    email: isPlaceholderEmail(user.email) ? null : user.email,
    image: user.image ?? null,
    role: roleOf(user.role),
  }
}

export type StandardAuthInput<A extends AdminOptions> = {
  /** The app's name, shown by passkey managers. */
  appName: string
  /** The site's public address, `https://…`. */
  siteUrl: string
  settings: AuthSettings
  /** Better Auth's database: `drizzleAdapter(db, { provider: 'sqlite', schema })`, or a `bun:sqlite` database. */
  database: BetterAuthOptions['database']
  /** The admin plugin's access control and roles: `{ ac, roles, defaultRole: 'user', adminRoles: ['admin'] }`. */
  admin: A & { defaultRole: string; adminRoles: string[] }
  /** Which of these usernames are used: one query, for a new Google account's username. */
  takenUsernames: (candidates: string[]) => Promise<ReadonlySet<string>>
  /** The username base when a name gives too little ("listener", "member"…). */
  usernameFallback: string
  /**
   * Which origins may use passkeys. `'listed'` (the default): the site, `localOrigins` and the Android
   * app (`androidCertSha256`). `'request'`: the request's own origin, which `trustedBaseUrl` limits to
   * the site and local hosts, so the site, previews and any local port work, each with its own
   * passkeys. `'request'` can't serve the Android app.
   */
  passkeyOrigin?: 'listed' | 'request'
  /** Local origins allowed to use passkeys (development and E2E) with `passkeyOrigin: 'listed'`: `['http://localhost:5173']`. */
  localOrigins?: readonly string[]
  /** The Android app's signing certificates (SHA-256, `AB:CD:…`), for passkeys in the app. */
  androidCertSha256?: readonly string[]
  /** Where rate-limit counts go: `counterRateLimit(store)`. Without it, Better Auth's database storage. */
  rateLimitStorage?: BetterAuthRateLimitStorage
  /** Bun's argon2id (`@jgb-solutions/kit/auth/bun`); without it, Better Auth's scrypt. */
  password?: PasswordHasher
  /** The name of a readable "signed in" cookie, when cached public pages need one. */
  signedInFlag?: string
  /** Removes the account's own data before it is deleted. Without it, accounts can't delete themselves. */
  beforeDeleteUser?: (user: { id: string }) => Promise<void>
  /** Sessions last this many days (30), renewed once a day while in use. */
  sessionDays?: number
  /** IP headers for rate limits, in order: only ones your proxy sets (`cf-connecting-ip` by default). */
  ipAddressHeaders?: string[]
  /** The app's own plugins, after the standard ones. */
  plugins?: BetterAuthPlugin[]
  /** Must stay last: `tanstackStartCookies()` on TanStack Start, so server functions can set cookies. */
  lastPlugin?: BetterAuthPlugin
}

/**
 * The standard Better Auth options, for `betterAuth(standardAuthOptions({...}))`: username and email
 * sign-in with a password (no email ever sent: nothing to verify, no reset link), passkeys, Google
 * when its keys are set (it joins only confirmed accounts; a username from the name), roles through the admin
 * plugin with the first admins from ADMIN_EMAILS (confirmed addresses only), the bearer plugin for the mobile app, rate limits,
 * 30-day sessions and a 5-minute cookie cache.
 */
export function standardAuthOptions<A extends AdminOptions>(input: StandardAuthInput<A>) {
  const { settings } = input
  const fromRequest = input.passkeyOrigin === 'request'
  if (fromRequest && (input.androidCertSha256?.length || input.localOrigins?.length))
    throw new Error("passkeyOrigin 'request' can't take androidCertSha256 or localOrigins: use 'listed'.")
  const days = input.sessionDays ?? 30
  return {
    appName: input.appName,
    baseURL: trustedBaseUrl(input.siteUrl),
    secret: settings.secret,
    database: input.database,
    emailAndPassword: {
      enabled: true,
      disableSignUp: !settings.signUp,
      requireEmailVerification: false,
      minPasswordLength: PASSWORD.min,
      maxPasswordLength: PASSWORD.max,
      ...(input.password ? { password: input.password } : {}),
    },
    ...(settings.google ? { socialProviders: { google: googleProvider(settings.google, { signUp: settings.signUp }) } } : {}),
    account: { accountLinking: CONFIRMED_ACCOUNT_LINKING },
    session: { expiresIn: days * 24 * 60 * 60, updateAge: 24 * 60 * 60, cookieCache: { enabled: true, maxAge: 5 * 60 } },
    ...(input.beforeDeleteUser ? { user: { deleteUser: { enabled: true, beforeDelete: input.beforeDeleteUser } } } : {}),
    rateLimit: {
      enabled: settings.rateLimit,
      window: 60,
      max: 60,
      customRules: { ...RATE_LIMIT_RULES },
      ...(input.rateLimitStorage ? { customStorage: input.rateLimitStorage } : { storage: 'database' as const }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user: { email: string; name: string } & Record<string, unknown>) => {
            const data: Record<string, unknown> = {
              ...user,
              role: roleForNewUser(user, settings.adminEmails, input.admin.defaultRole, input.admin.adminRoles[0] ?? 'admin'),
            }
            if (typeof data.username !== 'string' || !data.username) {
              const name = await freeUsername(user.name, user.email, input.takenUsernames, input.usernameFallback)
              data.username = name
              data.displayUsername = name
            }
            return { data }
          },
        },
      },
      account: {
        create: {
          after: async (
            account: { providerId: string; userId: string; idToken?: string | null | undefined },
            ctx: AccountHookContext | null,
          ) => {
            if (ctx) await afterAccountSaved(account, ctx.context.internalAdapter, await currentSessionToken(ctx))
          },
        },
      },
    },
    ...(input.signedInFlag ? { hooks: { after: signedInFlagHook(input.signedInFlag) } } : {}),
    advanced: { ipAddress: { ipAddressHeaders: input.ipAddressHeaders ?? ['cf-connecting-ip'] } },
    plugins: [
      username({ minUsernameLength: USERNAME.min, maxUsernameLength: USERNAME.max }),
      passkey({
        rpName: input.appName,
        // Without an origin list, Better Auth checks passkeys against the request's own origin.
        ...(fromRequest
          ? {}
          : {
              origin: passkeyOrigins(input.siteUrl, {
                ...(input.localOrigins ? { local: input.localOrigins } : {}),
                ...(input.androidCertSha256 ? { androidCertSha256: input.androidCertSha256 } : {}),
              }),
            }),
      }),
      admin(input.admin),
      bearer(),
      ...(input.plugins ?? []),
      ...(input.lastPlugin ? [input.lastPlugin] : []),
    ],
  } satisfies BetterAuthOptions
}
