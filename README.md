# @jgb-solutions/kit

Small, typed, tree-shakable modules for the generic plumbing web apps need: the kind of code every app would otherwise copy by hand. ESM with TypeScript types, one subpath per module, MIT licensed. The modules run anywhere with Web Crypto and `fetch`: Bun, Node and Cloudflare Workers (`kit/auth/bun` on Bun only, `kit/auth/expo` in React Native).

```bash
bun add @jgb-solutions/kit
```

## Modules

### `@jgb-solutions/kit/access`: Cloudflare Access, checked on the server

Cloudflare Access signs people in at the edge and passes a signed token (RS256) with each request it lets through: the `Cf-Access-Jwt-Assertion` header and the `CF_Authorization` cookie. An edge rule only covers the paths it matches, so client-side navigation, server functions and RPC calls can reach the server without passing through it. Check the token on the server for every protected call:

```ts
import { verifyAccess } from '@jgb-solutions/kit/access'

// The app's own Access application: its team domain and audience (AUD) tag.
const settings = { teamDomain: '<team>.cloudflareaccess.com', aud: '<the application AUD tag>' }

const result = await verifyAccess(request.headers, settings)
if (!result.ok) return new Response('Forbidden', { status: 403 }) // result.reason says why
result.email // the signed-in person (null for a service token)
```

- **Fails closed.** Missing settings, no token, a bad signature, the wrong issuer or audience, an expired token or keys that can't be fetched all return `{ ok: false, reason }`. It never throws.
- **RS256 only.** The issuer must be `https://<team>.cloudflareaccess.com`, and the token must carry `exp`, `iat`, `iss` and `aud`. The default clock tolerance is 30 seconds.
- **Keys:** Access's public keys for the team, fetched from its `cdn-cgi/access/certs` endpoint and cached (5-second timeout).
- **Tests sign their own tokens.** A test server makes a throwaway key pair and passes the public key set in `ACCESS_TEST_JWKS`. `accessTestKeys(env, { enabled })` returns those keys only when the caller says it is a test server:

  ```ts
  const keys = accessTestKeys(process.env, { enabled: process.env.E2E === '1' && !isProductionBuild })
  const result = await verifyAccess(headers, { ...settings, ...(keys ? { keys } : {}) })
  ```

- **The production guard.** Anyone holding a test key could sign in where test keys are accepted. Where the production build starts, refuse to run with any test-only setting:

  ```ts
  const problems = accessTestProblems(process.env, { production: isProductionBuild, alsoForbidden: ['E2E'] })
  if (problems.length) throw new Error(problems.join('\n'))
  ```

Keep the app's own role check after this one: Access decides who may reach the app, and the app decides what they may do.

### `@jgb-solutions/kit/auth`: Better Auth, the same in every app

Sign-in set up once for every app: a username or email with a password, passkeys (also the way back into an account whose password is forgotten, since no email is ever sent), "Continue with Google" when its keys are set, roles with an admin panel, and the same session for the website (cookie) and the mobile app (`Authorization: Bearer`).

It needs `better-auth` and `@better-auth/passkey` (and `@orpc/server` for `kit/auth/orpc`). They are **optional peer dependencies**: install them in the apps that use auth, and an app that only uses `kit/access` never gets them.

```bash
bun add @jgb-solutions/kit better-auth @better-auth/passkey
```

```ts
import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { authSettings, standardAuthOptions } from '@jgb-solutions/kit/auth'
import { argon2idHasher } from '@jgb-solutions/kit/auth/bun' // on Bun (Workers keep Better Auth's scrypt); fallbackVerify for older hashes

export const auth = betterAuth(
  standardAuthOptions({
    appName: 'Example',
    siteUrl: 'https://app.example.com',
    settings: authSettings(process.env), // BETTER_AUTH_SECRET, SIGN_UP, ADMIN_EMAILS, GOOGLE_*
    database: drizzleAdapter(db, { provider: 'sqlite', schema }),
    admin: { ac, roles, defaultRole: 'user', adminRoles: ['admin'] }, // the app's permissions
    takenUsernames: (candidates) => findUsedUsernames(candidates), // one query
    usernameFallback: 'member',
    localOrigins: ['http://localhost:5173'],
    password: argon2idHasher(),
    beforeDeleteUser: (user) => deleteEverythingOf(user.id),
    lastPlugin: tanstackStartCookies(),
  }),
)
```

What the preset sets:

- **Passwords:** 12 to 128 characters, with no email verification and no reset link (no email is ever sent). `SIGN_UP=off` closes sign-up; existing accounts still sign in.
- **Usernames** (Better Auth's username plugin): 3 to 30 characters, lower-case letters, digits, dots and underscores. An account made without one (Google) gets one from its name, with a number when it's taken.
- **Passkeys** for the site, the `localOrigins` and the Android app (`androidCertSha256`). With `passkeyOrigin: 'request'`, the request's own origin instead (the site, previews and any local port; one of `trustedBaseUrl`'s hosts), for apps without an Android app.
- **Google**, when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. `GOOGLE_MOBILE_CLIENT_IDS` adds the apps' clients, for ID-token sign-in. A new Google address makes a new account with a confirmed address. Joining existing accounts is "merge only confirmed" (see below).
- **Roles:** Better Auth's admin plugin, with the app's access control. A new account whose address is in `ADMIN_EMAILS` starts as admin when it's created with Google (a confirmed address); a sign-up with that address by email and password starts as an ordinary user, so nobody can claim an admin's address first. Other first admins are promoted from the server (the app's admin script).
- **The mobile app:** the bearer plugin.
- **Limits:** 60 requests a minute, tighter on sign-in, sign-up, passkeys and password changes (`RATE_LIMIT_RULES`). Counts go in the database, or in a counter store with `rateLimitStorage: counterRateLimit(() => redis)`, which lets attempts through when the store is down.
- **Sessions:** 30 days, renewed daily, with a 5-minute cookie cache. The base URL is the request's host only for the site or a local host; anything else falls back to the site.

#### Google and existing accounts: merge only confirmed

The app never sends email, so an address typed at sign-up is never confirmed. Someone could sign up first with another person's address and a password they know. So **"Continue with Google" joins an existing account with the same address only when that account's address is confirmed**: it was made with Google, or by an admin. Otherwise Better Auth refuses, and the app shows the way in:

1. **On the sign-in page**, the refusal arrives as `?error=account_not_linked` after Google's redirect, or as an error body from an ID-token sign-in. `authErrorCode(answer)` (`kit/auth/rules`) turns either into `ACCOUNT_NOT_LINKED`. The page says: _An account with this address already exists. Sign in with your password, then connect Google from your account page._
2. **On the account page**, "Connect Google" calls Better Auth's `/link-social` for the signed-in person: `auth.api.linkSocialAccount({ body: { provider: 'google', callbackURL: '/account', errorCallbackURL: '/account' }, headers })` on the website (go to the `url` it returns), or `auth.linkGoogle(idToken)` in the app. The Google address may differ from the account's (username accounts have a placeholder address). Every session of the account stays (the owner proved both sides), and the account takes Google's picture if it had none. From then on, "Continue with Google" signs into it.
3. A Google account that already belongs to another account gives `GOOGLE_ALREADY_LINKED`. A Google address Google didn't verify gives `GOOGLE_EMAIL_NOT_CONFIRMED`.

When a Google sign-in joins a confirmed account that also has a password, every session of that account ends: one someone else held doesn't carry on. A browser signed into another account counts as such a sign-in, not as the owner connecting.

Everything the preset uses is exported on its own, for an app that needs a different mix (`authSettings`, `trustedBaseUrl`, `passkeyOrigins`, `androidOrigin`, `assetLinks`, `googleProvider`, `CONFIRMED_ACCOUNT_LINKING`, `freeUsername`, `afterAccountSaved`, `pictureFromIdToken`, `signedInFlagHook`, `asPublicRequest`, `toAuthUser`). What stays in the app is its own: its name and address, database and schema (`bunx auth@latest generate`), roles and permissions, texts, pages, and its Google, Android and Access identifiers.

#### `kit/auth/orpc`: the person in `context.user`

```ts
import { authMiddleware } from '@jgb-solutions/kit/auth/orpc'

const { withUser, requireUser, requireAdmin } = authMiddleware({
  viewer: async () => toAuthUser((await auth.api.getSession({ headers }))?.user, roleOf), // cookie or Bearer
  canOpenAdmin,
  adminCheck: async () => (await verifyAccess(headers, access)).ok, // optional: Cloudflare Access too
})
```

`requireUser` answers `UNAUTHORIZED`, and `requireAdmin` answers `FORBIDDEN` for a role that can't open the admin panel or a failed `adminCheck`. Both mark the answer `private, no-store`.

#### `kit/auth/rules`: the same rules in the browser

`USERNAME`, `PASSWORD`, `usernameProblem`, `isPlaceholderEmail`, `placeholderEmail`, `defineRoles({ roles, defaultRole, adminPanel })` (`roleOf`, `canOpenAdmin`, `isRole`), the `AuthUser` type, `authErrorCode` with `ACCOUNT_NOT_LINKED`, `GOOGLE_ALREADY_LINKED` and `GOOGLE_EMAIL_NOT_CONFIRMED`, `avatarSrc` (https pictures only, sized) and `avatarInitials`. No dependencies.

#### `kit/auth/expo`: the mobile app

```ts
import * as SecureStore from 'expo-secure-store'
import * as Passkeys from 'react-native-passkeys'
import { createMobileAuth } from '@jgb-solutions/kit/auth/expo'

export const auth = createMobileAuth({ origin: 'https://app.example.com', storage: SecureStore, tokenKey: 'example.session', fetchMe })

const session = useSyncExternalStore(auth.subscribe, auth.getSession)
await auth.signIn('maria', password) // or an email address
await auth.signInWithGoogle(idToken) // from the app's Google Sign-In SDK
await auth.linkGoogle(idToken) // signed in: connect Google from the account screen
await auth.signInWithPasskey(Passkeys)
new RPCLink({ url, headers: auth.authHeaders }) // Bearer on every RPC call
```

Failures come back as codes (`INVALID_USERNAME_OR_PASSWORD`, `ACCOUNT_NOT_LINKED`, `GOOGLE_ALREADY_LINKED`, `TOO_MANY_REQUESTS`, `NETWORK`, `CANCELLED`…), and the app words them. The module has no dependencies: the app passes in its secure storage and passkey modules.

## What goes in, and what never goes in

**In:** generic plumbing that several apps need in the same shape, written once and tested: checking a signed token, parsing a header, a retry or rate-limit helper, a typed client for a public protocol. Every module:

- takes its settings from the caller (team names, audiences, URLs, limits);
- has full unit tests;
- has no side effects at import, and no dependency it doesn't need.

**Never in:**

- **Business logic:** how an app works, decides, charges or ranks. That stays in the app.
- **Secrets of any kind:** keys, tokens, passwords, signing material.
- **App and account identifiers:** Access team names and AUD tags, account or zone IDs, database or bucket names, app slugs.
- **Infrastructure details:** hosts, IP addresses, server names, internal URLs, deploy setup.
- **Personal data, or real addresses outside `example.com`.**

`bun run check:package` scans every file that would be published, before each publish and in CI. It fails on an Access team domain other than the examples, on a 32- or 64-character hex ID, on an address outside `example.com`, on any file besides `dist/`, the README, the changelog, the license and `package.json`, and on a module importing more than it may (`kit/access` jose alone; `kit/auth/rules`, `kit/auth/expo` and `kit/auth/bun` nothing). `bun run check:install` installs the packed package without the optional peers and checks that `kit/access`, `kit/auth/rules` and `kit/auth/expo` load and type-check there.

## Developing

Bun only: `bun install`, `bun test`, `bun run typecheck` (`bun check`), `bun run format` (`bun fmt`), `bun run build` (one ESM file per export, plus `.d.ts` types), `bun run check:package`, `bun run check:install`.

A new module goes in `src/<name>.ts` (or `src/<group>/<name>.ts`) with its test next to it. It gets its own subpath in `package.json`'s `exports` (`./<name>` pointing at `./dist/<name>.js` and `./dist/<name>.d.ts`), and its allowed imports in `IMPORTS` in `scripts/check-package.ts`. A library it needs is an optional peer dependency, unless every module needs it.

## Publishing

Every release from 0.1.1 on comes from GitHub, with provenance. GitHub Actions publishes (`.github/workflows/publish.yml`) when a GitHub release is published for the tag `vX.Y.Z` matching `package.json`'s version, after the run is approved in the `npm` environment. It uses npm's trusted publishing (OIDC): no npm token is stored anywhere, and npm attaches a provenance statement that links each version to the commit and workflow that built it (check it on the package's npm page, or with `npm audit signatures`). A stable version moves the `latest` tag; a prerelease (`1.2.0-beta.1`) goes to `next`.

0.1.0, the first version, was published by hand: npm only lets a trusted publisher be set up on a package that already exists. It has no provenance; its code is the same as 0.1.1's.

Versions follow semver. A breaking change to any module is a new major version.
