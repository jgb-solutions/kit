import { describe, expect, test } from 'bun:test'
import { call, ORPCError, os } from '@orpc/server'
import { authMiddleware } from './orpc'

type User = { id: string; role: string }

function procedures(user: User | null, adminCheck?: () => Promise<boolean>) {
  const { withUser, requireUser, requireAdmin } = authMiddleware<User>({
    viewer: async () => user,
    canOpenAdmin: (role) => role.split(',').includes('admin'),
    ...(adminCheck ? { adminCheck } : {}),
  })
  const base = os.$context<{ resHeaders?: Headers }>().use(withUser)
  return {
    whoami: base.handler(({ context }) => context.user?.id ?? null),
    me: base.use(requireUser).handler(({ context }) => context.user.id),
    admin: base.use(requireAdmin).handler(({ context }) => context.user.id),
  }
}

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise
    return 'OK'
  } catch (error) {
    return error instanceof ORPCError ? error.code : 'OTHER'
  }
}

describe('authMiddleware', () => {
  test('withUser gives null or the person; public answers stay cacheable', async () => {
    const resHeaders = new Headers()
    expect(await call(procedures(null).whoami, undefined, { context: { resHeaders } })).toBeNull()
    expect(resHeaders.get('cache-control')).toBeNull()
  })

  test('requireUser: UNAUTHORIZED when signed out, private no-store when signed in', async () => {
    expect(await codeOf(call(procedures(null).me, undefined, { context: {} }))).toBe('UNAUTHORIZED')
    const resHeaders = new Headers()
    expect(await call(procedures({ id: 'u1', role: 'user' }).me, undefined, { context: { resHeaders } })).toBe('u1')
    expect(resHeaders.get('cache-control')).toBe('private, no-store')
  })

  test('requireAdmin: the role, then the extra check', async () => {
    expect(await codeOf(call(procedures(null).admin, undefined, { context: {} }))).toBe('UNAUTHORIZED')
    expect(await codeOf(call(procedures({ id: 'u1', role: 'user' }).admin, undefined, { context: {} }))).toBe('FORBIDDEN')
    expect(await call(procedures({ id: 'a1', role: 'user,admin' }).admin, undefined, { context: {} })).toBe('a1')
    const denied = procedures({ id: 'a1', role: 'admin' }, async () => false)
    expect(await codeOf(call(denied.admin, undefined, { context: {} }))).toBe('FORBIDDEN')
  })
})
