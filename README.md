# @jgb-solutions/kit

Small, typed, tree-shakable modules for the generic plumbing web apps need: the kind of code every app would otherwise copy by hand. ESM with TypeScript types, one subpath per module, MIT licensed. The modules run anywhere with Web Crypto and `fetch`: Bun, Node and Cloudflare Workers.

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

`bun run check:package` scans every file that would be published, before each publish and in CI. It fails on an Access team domain other than the examples, on a 32- or 64-character hex ID, on an address outside `example.com`, and on any file besides `dist/`, the README, the license and `package.json`.

## Developing

Bun only: `bun install`, `bun test`, `bun run typecheck` (`bun check`), `bun run format` (`bun fmt`), `bun run build` (one ESM file per export, plus `.d.ts` types), `bun run check:package`.

A new module goes in `src/<name>.ts` with `src/<name>.test.ts`, and gets its own subpath in `package.json`'s `exports` (`./<name>` pointing at `./dist/<name>.js` and `./dist/<name>.d.ts`).

## Publishing

Only GitHub Actions publishes (`.github/workflows/publish.yml`), when a GitHub release is published for the tag `vX.Y.Z` matching `package.json`'s version. It uses npm's trusted publishing (OIDC): no npm token is stored anywhere, and npm attaches a provenance statement that links each version to the commit and workflow that built it. The `npm` environment can hold each publish for the owner's approval.

Versions follow semver. A breaking change to any module is a new major version.
