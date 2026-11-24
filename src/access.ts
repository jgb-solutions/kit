/**
 * Cloudflare Access, checked on the server.
 *
 * Access signs people in at the edge and sends a signed token (a JWT, RS256) with every request it
 * lets through: the `Cf-Access-Jwt-Assertion` header, and the `CF_Authorization` cookie it sets for
 * the host. An edge rule only covers what it matches: client-side navigation and server functions
 * (`/_serverFn/…`, RPC calls) often don't pass through it. So the app checks the token itself, on every
 * protected call, with the team domain and the application's audience (AUD) tag it passes in.
 *
 * Fails closed: no settings, no token, a bad signature, the wrong issuer or audience, an expired
 * token, or keys that can't be fetched all mean no access.
 *
 *   import { verifyAccess } from '@jgb-solutions/kit/access'
 *   const result = await verifyAccess(request.headers, { teamDomain, aud })
 *   if (!result.ok) return new Response('Forbidden', { status: 403 })
 */
import { createLocalJWKSet, createRemoteJWKSet, errors, jwtVerify, type JSONWebKeySet, type JWTVerifyGetKey } from 'jose'

export type AccessSettings = {
  /** The Zero Trust team domain: `<team>.cloudflareaccess.com`. */
  teamDomain: string
  /** The Access application's audience (AUD) tag. */
  aud: string
  /**
   * The keys that sign the tokens. Leave it out in production: Access's public keys for the team are
   * fetched from `https://<team>/cdn-cgi/access/certs` and cached. Tests pass `accessTestKeys(…)`.
   */
  keys?: JWTVerifyGetKey
  /** Allowed clock difference with Cloudflare, in seconds (30 by default). */
  clockToleranceSeconds?: number
}

export type AccessFailure =
  'not-configured' | 'no-token' | 'bad-signature' | 'wrong-issuer' | 'wrong-audience' | 'expired' | 'keys-unavailable' | 'invalid'

export type AccessResult =
  | {
      ok: true
      /** The signed-in person's email, when the token carries one (service tokens don't). */
      email: string | null
      /** The token's subject: the Access user ID, or the service token's client ID. */
      subject: string | null
    }
  | { ok: false; reason: AccessFailure }

/** The token Access sent: its header first, then its cookie (server functions only carry the cookie). */
export function accessToken(headers: Headers): string | null {
  const header = headers.get('cf-access-jwt-assertion')?.trim()
  if (header) return header
  for (const part of (headers.get('cookie') ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === 'CF_Authorization') return rest.join('=') || null
  }
  return null
}

const TEAM_DOMAIN = /^[a-z0-9-]+\.cloudflareaccess\.com$/

/** Keys per team, made once: jose caches them and fetches again only for an unknown key ID. */
const remoteKeys = new Map<string, JWTVerifyGetKey>()

function keysFor(teamDomain: string): JWTVerifyGetKey {
  let keys = remoteKeys.get(teamDomain)
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`), { timeoutDuration: 5000 })
    remoteKeys.set(teamDomain, keys)
  }
  return keys
}

/** Checks the request's Access token against the team and application. Never throws. */
export async function verifyAccess(headers: Headers, settings: AccessSettings | null | undefined): Promise<AccessResult> {
  // Checked at run time too: JavaScript callers and settings read from the environment can pass anything.
  if (
    typeof settings?.aud !== 'string' ||
    !settings.aud.trim() ||
    typeof settings.teamDomain !== 'string' ||
    !TEAM_DOMAIN.test(settings.teamDomain)
  )
    return { ok: false, reason: 'not-configured' }
  const token = accessToken(headers)
  if (!token) return { ok: false, reason: 'no-token' }
  try {
    const { payload } = await jwtVerify(token, settings.keys ?? keysFor(settings.teamDomain), {
      issuer: `https://${settings.teamDomain}`,
      audience: settings.aud,
      algorithms: ['RS256'],
      // Access tokens always carry these; a token without them isn't one.
      requiredClaims: ['exp', 'iat', 'iss', 'aud'],
      clockTolerance: settings.clockToleranceSeconds ?? 30,
    })
    return {
      ok: true,
      email: typeof payload.email === 'string' ? payload.email : null,
      subject: typeof payload.sub === 'string' ? payload.sub : null,
    }
  } catch (error) {
    return { ok: false, reason: failureOf(error) }
  }
}

function failureOf(error: unknown): AccessFailure {
  if (error instanceof errors.JWTExpired) return 'expired'
  if (error instanceof errors.JWTClaimValidationFailed) {
    if (error.claim === 'iss') return 'wrong-issuer'
    if (error.claim === 'aud') return 'wrong-audience'
    return 'invalid'
  }
  if (error instanceof errors.JWSSignatureVerificationFailed || error instanceof errors.JWKSNoMatchingKey) return 'bad-signature'
  if (error instanceof errors.JWKSTimeout || error instanceof errors.JWKSInvalid || error instanceof TypeError) return 'keys-unavailable'
  return 'invalid'
}

/** The environment variables that only an app's test server may set (see `accessTestKeys`). */
export const ACCESS_TEST_VARIABLES = ['ACCESS_TEST_JWKS', 'ACCESS_TEST_TEAM_DOMAIN', 'ACCESS_TEST_AUD'] as const

/**
 * Test keys: a test server signs its own tokens with a throwaway key pair and passes the public half
 * as a JSON Web Key Set in `ACCESS_TEST_JWKS`. Returns those keys only when the caller says this is a
 * test server (`enabled`); otherwise undefined, so the real keys are used. Anyone holding a test key
 * could sign in where these keys are accepted: enable them only in tests, and run
 * `accessTestProblems` where the production build starts.
 */
export function accessTestKeys(env: Record<string, string | undefined>, options: { enabled: boolean }): JWTVerifyGetKey | undefined {
  if (!options.enabled) return undefined
  const jwks = env.ACCESS_TEST_JWKS
  return jwks ? createLocalJWKSet(parseKeySet(jwks)) : undefined
}

/**
 * The production guard: what a production server must refuse to start with. Lists every test-only
 * variable that is set (`ACCESS_TEST_*`, plus any the app names in `alsoForbidden`, such as its E2E
 * flag); empty when the environment is safe. Outside production it always returns an empty list.
 *
 *   const problems = accessTestProblems(process.env, { production: process.env.APP_IMAGE === '1', alsoForbidden: ['E2E'] })
 *   if (problems.length) throw new Error(problems.join('\n'))
 */
export function accessTestProblems(
  env: Record<string, string | undefined>,
  options: { production: boolean; alsoForbidden?: readonly string[] },
): string[] {
  if (!options.production) return []
  const set = (name: string) => env[name] !== undefined && env[name] !== ''
  return [...ACCESS_TEST_VARIABLES, ...(options.alsoForbidden ?? [])]
    .filter(set)
    .map((name) => `${name} is set; it is for the test server only`)
}

function parseKeySet(text: string): JSONWebKeySet {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('ACCESS_TEST_JWKS must be a JSON Web Key Set (it is not JSON)')
  }
  if (typeof value !== 'object' || value === null || !('keys' in value) || !Array.isArray(value.keys)) {
    throw new Error('ACCESS_TEST_JWKS must be a JSON Web Key Set ({ "keys": [...] })')
  }
  return { keys: value.keys.filter((key): key is JSONWebKeySet['keys'][number] => typeof key === 'object' && key !== null) }
}
