import { describe, expect, test } from 'bun:test'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose'
import { ACCESS_TEST_VARIABLES, accessTestKeys, accessTestProblems, accessToken, verifyAccess, type AccessSettings } from './access'

const TEAM = 'example-team.cloudflareaccess.com'
const AUD = 'test-audience-tag'

/** A throwaway key pair, as a test server would make one, and the matching settings. */
async function setup() {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256' }
  const jwks = JSON.stringify({ keys: [jwk] })
  const settings: AccessSettings = { teamDomain: TEAM, aud: AUD, keys: createLocalJWKSet({ keys: [jwk] }) }
  const sign = (claims: JWTPayload = {}, options: { alg?: string; expiresIn?: string | number; key?: CryptoKey } = {}) =>
    // The test's claims go last, so a test can set a wrong issuer or audience.
    new SignJWT({ iss: `https://${TEAM}`, aud: AUD, sub: 'user-123', email: 'owner@example.com', ...claims })
      .setProtectedHeader({ alg: options.alg ?? 'RS256', kid: 'test-key' })
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? '10m')
      .sign(options.key ?? privateKey)
  return { settings, sign, jwks }
}

const withHeader = (token: string) => new Headers({ 'cf-access-jwt-assertion': token })

describe('accessToken', () => {
  test('reads the header first, then the CF_Authorization cookie', () => {
    expect(accessToken(new Headers({ 'cf-access-jwt-assertion': 'from-header', cookie: 'CF_Authorization=from-cookie' }))).toBe(
      'from-header',
    )
    expect(accessToken(new Headers({ cookie: 'theme=dark; CF_Authorization=a.b.c; other=1' }))).toBe('a.b.c')
  })
  test('keeps "=" inside the cookie value, and ignores lookalike cookie names', () => {
    expect(accessToken(new Headers({ cookie: 'CF_Authorization=abc==' }))).toBe('abc==')
    expect(accessToken(new Headers({ cookie: 'XCF_Authorization=a; CF_Authorization_old=b' }))).toBeNull()
  })
  test('is null without a token, or with an empty one', () => {
    expect(accessToken(new Headers())).toBeNull()
    expect(accessToken(new Headers({ 'cf-access-jwt-assertion': '  ', cookie: 'CF_Authorization=' }))).toBeNull()
  })
})

describe('verifyAccess', () => {
  test('accepts a valid token from the header or the cookie, with its email and subject', async () => {
    const { settings, sign } = await setup()
    const token = await sign()
    expect(await verifyAccess(withHeader(token), settings)).toEqual({ ok: true, email: 'owner@example.com', subject: 'user-123' })
    expect(await verifyAccess(new Headers({ cookie: `CF_Authorization=${token}` }), settings)).toMatchObject({ ok: true })
  })
  test('a service token without an email is accepted with email null', async () => {
    const { settings, sign } = await setup()
    expect(await verifyAccess(withHeader(await sign({ email: undefined })), settings)).toMatchObject({ ok: true, email: null })
  })

  test('fails closed without settings, or with a team domain that is not Access', async () => {
    const { settings, sign } = await setup()
    const headers = withHeader(await sign())
    expect(await verifyAccess(headers, null)).toEqual({ ok: false, reason: 'not-configured' })
    expect(await verifyAccess(headers, undefined)).toEqual({ ok: false, reason: 'not-configured' })
    expect(await verifyAccess(headers, { ...settings, aud: ' ' })).toEqual({ ok: false, reason: 'not-configured' })
    expect(await verifyAccess(headers, { ...settings, teamDomain: 'evil.example.com' })).toEqual({ ok: false, reason: 'not-configured' })
    expect(await verifyAccess(headers, { ...settings, teamDomain: `x.${TEAM}.evil.com` })).toEqual({ ok: false, reason: 'not-configured' })
  })
  test('no token', async () => {
    const { settings } = await setup()
    expect(await verifyAccess(new Headers(), settings)).toEqual({ ok: false, reason: 'no-token' })
  })
  test('a token signed by another key', async () => {
    const { settings } = await setup()
    const other = await setup()
    expect(await verifyAccess(withHeader(await other.sign()), settings)).toEqual({ ok: false, reason: 'bad-signature' })
  })
  test('a tampered token', async () => {
    const { settings, sign } = await setup()
    const [header, , signature] = (await sign()).split('.')
    const payload = Buffer.from(JSON.stringify({ email: 'attacker@example.com', aud: AUD, iss: `https://${TEAM}` })).toString('base64url')
    expect(await verifyAccess(withHeader(`${header}.${payload}.${signature}`), settings)).toMatchObject({ ok: false })
  })
  test('the wrong issuer or audience', async () => {
    const { settings, sign } = await setup()
    expect(await verifyAccess(withHeader(await sign({ iss: 'https://other.cloudflareaccess.com' })), settings)).toEqual({
      ok: false,
      reason: 'wrong-issuer',
    })
    expect(await verifyAccess(withHeader(await sign({ aud: 'another-app' })), settings)).toEqual({ ok: false, reason: 'wrong-audience' })
  })
  test('an expired token, past the clock tolerance', async () => {
    const { settings, sign } = await setup()
    const expired = await sign({}, { expiresIn: Math.floor(Date.now() / 1000) - 60 })
    expect(await verifyAccess(withHeader(expired), settings)).toEqual({ ok: false, reason: 'expired' })
    // Within the tolerance it still passes.
    expect(await verifyAccess(withHeader(expired), { ...settings, clockToleranceSeconds: 120 })).toMatchObject({ ok: true })
  })
  test('anything but RS256 is refused, and so is garbage', async () => {
    const { settings } = await setup()
    const hmac = await new SignJWT({ email: 'owner@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(`https://${TEAM}`)
      .setAudience(AUD)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode('a-shared-secret-of-at-least-32-bytes!!'))
    expect(await verifyAccess(withHeader(hmac), settings)).toMatchObject({ ok: false })
    expect(await verifyAccess(withHeader('not-a-jwt'), settings)).toEqual({ ok: false, reason: 'invalid' })
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(`{"aud":"${AUD}"}`).toString('base64url')}.`
    expect(await verifyAccess(withHeader(none), settings)).toMatchObject({ ok: false })
  })
  test('a token missing the claims every Access token has', async () => {
    const { settings } = await setup()
    const { privateKey } = await generateKeyPair('RS256')
    const noExp = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(`https://${TEAM}`)
      .setAudience(AUD)
      .sign(privateKey)
    expect(await verifyAccess(withHeader(noExp), settings)).toMatchObject({ ok: false })
  })
  test('keys that cannot be fetched fail closed and never throw', async () => {
    const { sign } = await setup()
    const unreachable: AccessSettings = {
      teamDomain: TEAM,
      aud: AUD,
      keys: async () => {
        throw new TypeError('fetch failed')
      },
    }
    expect(await verifyAccess(withHeader(await sign()), unreachable)).toEqual({ ok: false, reason: 'keys-unavailable' })
  })
})

describe('accessTestKeys', () => {
  test('gives the test keys only when the caller enables them', async () => {
    const { sign, jwks } = await setup()
    const env = { ACCESS_TEST_JWKS: jwks }
    expect(accessTestKeys(env, { enabled: false })).toBeUndefined()
    expect(accessTestKeys({}, { enabled: true })).toBeUndefined()
    const keys = accessTestKeys(env, { enabled: true })
    expect(await verifyAccess(withHeader(await sign()), { teamDomain: TEAM, aud: AUD, ...(keys ? { keys } : {}) })).toMatchObject({
      ok: true,
    })
  })
  test('refuses a value that is not a key set', () => {
    expect(() => accessTestKeys({ ACCESS_TEST_JWKS: 'nope' }, { enabled: true })).toThrow('not JSON')
    expect(() => accessTestKeys({ ACCESS_TEST_JWKS: '{"key":1}' }, { enabled: true })).toThrow('JSON Web Key Set')
  })
})

describe('accessTestProblems (the production guard)', () => {
  test('lists every test-only variable set in production, and nothing elsewhere', () => {
    const env = { ACCESS_TEST_JWKS: '{}', ACCESS_TEST_AUD: '', E2E: '1', PORT: '3000' }
    expect(accessTestProblems(env, { production: false, alsoForbidden: ['E2E'] })).toEqual([])
    expect(accessTestProblems(env, { production: true, alsoForbidden: ['E2E'] })).toEqual([
      'ACCESS_TEST_JWKS is set; it is for the test server only',
      'E2E is set; it is for the test server only',
    ])
    expect(accessTestProblems({ PORT: '3000' }, { production: true })).toEqual([])
  })
  test('covers every ACCESS_TEST_ variable', () => {
    const env = Object.fromEntries(ACCESS_TEST_VARIABLES.map((name) => [name, 'x']))
    expect(accessTestProblems(env, { production: true })).toHaveLength(ACCESS_TEST_VARIABLES.length)
  })
})
