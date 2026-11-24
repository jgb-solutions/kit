/**
 * Sign-in for an oRPC router, the same for every caller: the website's session cookie and the app's
 * `Authorization: Bearer <session token>` both reach Better Auth's session check (the app's `viewer`),
 * and `withUser` turns either into `context.user`, so services never know how the person signed in.
 *
 *   const { withUser, requireUser, requireAdmin } = authMiddleware({
 *     viewer: () => currentViewer(),                 // the app's session read
 *     canOpenAdmin,                                  // from defineRoles (kit/auth/rules)
 *     adminCheck: async () => (await verifyAccess(getRequestHeaders(), access)).ok, // optional: Cloudflare Access
 *   })
 *   export const me = os.use(withUser).use(requireUser).handler(({ context }) => context.user)
 *
 * Answers for a person are marked `private, no-store` (with oRPC's response-headers plugin), so no
 * CDN ever keeps them. Public procedures don't use `withUser`: their answers stay cacheable.
 *
 * Needs `@orpc/server` (an optional peer dependency of the kit).
 */
import { ORPCError, os } from '@orpc/server'

/** oRPC's ResponseHeadersHandlerPlugin context, when the app uses it. */
type HeadersContext = { resHeaders?: Headers }

export function authMiddleware<U extends { role: string }>(options: {
  /** The signed-in person, or null: the app's own session read (cookie or Bearer token). */
  viewer: () => Promise<U | null>
  /** Whether a role may open the admin panel. */
  canOpenAdmin: (role: string) => boolean
  /** An extra check for admin procedures, such as Cloudflare Access's token. False means FORBIDDEN. */
  adminCheck?: () => Promise<boolean>
}) {
  /** Reads the caller once per call: `context.user` is the signed-in person, or null. */
  const withUser = os.$context<HeadersContext>().middleware(async ({ next }) => next({ context: { user: await options.viewer() } }))

  /** Signed in, or UNAUTHORIZED. */
  const requireUser = os.$context<HeadersContext & { user: U | null }>().middleware(async ({ context, next }) => {
    if (!context.user) throw new ORPCError('UNAUTHORIZED')
    context.resHeaders?.set('cache-control', 'private, no-store')
    return next({ context: { user: context.user } })
  })

  /** Signed in with a role that may open the admin panel, and through `adminCheck`, or FORBIDDEN. */
  const requireAdmin = os.$context<HeadersContext & { user: U | null }>().middleware(async ({ context, next }) => {
    if (!context.user) throw new ORPCError('UNAUTHORIZED')
    if (!options.canOpenAdmin(context.user.role)) throw new ORPCError('FORBIDDEN')
    if (options.adminCheck && !(await options.adminCheck())) throw new ORPCError('FORBIDDEN')
    context.resHeaders?.set('cache-control', 'private, no-store')
    return next({ context: { user: context.user } })
  })

  return { withUser, requireUser, requireAdmin }
}
