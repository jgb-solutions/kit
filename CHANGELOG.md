# Changelog

All notable changes to `@jgb-solutions/kit`. Versions follow semver.

## 0.2.1

- `standardAuthOptions({ passkeyOrigin: 'request' })`: passkeys checked against the request's own origin, which `trustedBaseUrl` limits to the site and local hosts, so the site, previews and any local port each work (the jgb-starter template's setup). The default, `'listed'`, keeps the fixed list (the site, `localOrigins`, the Android app).

## 0.2.0

- `@jgb-solutions/kit/auth`: Better Auth set up the same way in every app. Pieces (`authSettings`, `trustedBaseUrl`, `passkeyOrigins`, `androidOrigin`, `assetLinks`, `RATE_LIMIT_RULES`, `counterRateLimit`, `googleProvider`, `CONFIRMED_ACCOUNT_LINKING`, `freeUsername`, `afterAccountSaved`, `pictureFromIdToken`, `signedInFlagHook`, `asPublicRequest`, `toAuthUser`) and the preset `standardAuthOptions`: username or email with a password, passkeys, Google that joins only confirmed accounts (connect Google from the account page otherwise), roles and the first admins (`ADMIN_EMAILS`, confirmed addresses only), Bearer sessions for the mobile app, rate limits, no email ever sent.
- `@jgb-solutions/kit/auth/bun`: `argon2idHasher()`, Bun's argon2id for passwords; `fallbackVerify` keeps older hashes (Better Auth's scrypt) working for an app moving over.
- `@jgb-solutions/kit/auth/orpc`: `authMiddleware` → `withUser`, `requireUser`, `requireAdmin` (with an optional extra check, such as Cloudflare Access).
- `@jgb-solutions/kit/auth/rules`: browser-safe rules (usernames, passwords, placeholder emails, `defineRoles`, `avatarSrc`, `avatarInitials`), and `authErrorCode` with `ACCOUNT_NOT_LINKED`, `GOOGLE_ALREADY_LINKED` and `GOOGLE_EMAIL_NOT_CONFIRMED`.
- `@jgb-solutions/kit/auth/expo`: `createMobileAuth`, the mobile app's session (secure storage, Bearer header), sign-in and sign-up, Google with an ID token (`signInWithGoogle`, `linkGoogle`), passkeys. No dependencies: the app passes in `expo-secure-store` and `react-native-passkeys`.
- `better-auth`, `@better-auth/passkey` and `@orpc/server` are optional peer dependencies: an app that only uses `kit/access` installs jose alone. `check:package` checks each module's imports, and `check:install` installs the package without the peers and checks `access`, `auth/rules` and `auth/expo` there.

## 0.1.1

- Published from GitHub Actions with npm trusted publishing and provenance: the first release built and published by CI. No code changes.
- The publish workflow sets the dist-tag explicitly: `latest` for stable versions, `next` for prereleases.

## 0.1.0

- `@jgb-solutions/kit/access`: Cloudflare Access's token, checked on the server (`verifyAccess`, `accessToken`, `accessTestKeys`, `accessTestProblems`). Published by hand, without provenance.
