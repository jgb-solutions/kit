/**
 * Account rules every part of an app shares: the website, its server and the mobile app. Browser-safe
 * and dependency-free (no Better Auth, no validator), so a sign-up form can check a username with the
 * same rule the server uses.
 *
 *   import { USERNAME, usernameProblem, defineRoles } from '@jgb-solutions/kit/auth/rules'
 */

/** Usernames: 3 to 30 characters, lower-case letters, digits, dots and underscores (Better Auth's username plugin rule too). */
export const USERNAME = { min: 3, max: 30, pattern: /^[a-z0-9_.]+$/ } as const

/** Passwords: 12 to 128 characters. Long beats complicated; no other rules. */
export const PASSWORD = { min: 12, max: 128 } as const

/** Why a username can't be used, or null when it can. The app words the message. */
export function usernameProblem(username: string): 'too-short' | 'too-long' | 'characters' | null {
  if (username.length < USERNAME.min) return 'too-short'
  if (username.length > USERNAME.max) return 'too-long'
  if (!USERNAME.pattern.test(username)) return 'characters'
  return null
}

/**
 * Better Auth needs an email address per account. An account made without one gets
 * `<random>@users.invalid` (`.invalid` is reserved: it can never receive mail). It is never shown or mailed.
 */
export const PLACEHOLDER_EMAIL_DOMAIN = 'users.invalid'

export function isPlaceholderEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`)
}

/** A new placeholder address, random enough never to collide. */
export function placeholderEmail(): string {
  return `${crypto.randomUUID().replaceAll('-', '')}@${PLACEHOLDER_EMAIL_DOMAIN}`
}

/**
 * A username made from a person's name, for accounts made with Google: "Marie-Ève Dupont" →
 * "marie.eve.dupont". Accents dropped, spaces and dashes to dots, anything else out, short enough to
 * take a 4-digit number. The email's first part, then `fallback`, stand in when the name gives too little.
 */
export function usernameFromName(name: string | null | undefined, email: string | null | undefined, fallback: string): string {
  const clean = (text: string) =>
    // Hermes (React Native) may lack normalize: accented letters are then dropped, not spelled plain.
    (typeof text.normalize === 'function' ? text.normalize('NFKD') : text)
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[\s-]+/g, '.')
      .replace(/[^a-z0-9_.]/g, '')
      .replace(/\.{2,}/g, '.')
      .replace(/^[._]+|[._]+$/g, '')
      .slice(0, USERNAME.max - 5)
      .replace(/[._]+$/g, '')
  for (const source of [name ?? '', (email ?? '').split('@')[0] ?? '']) {
    const base = clean(source)
    if (base.length >= USERNAME.min) return base
  }
  return clean(fallback) || 'member'
}

/** The name, then the name with a 4-digit number (8 of them), to find one nobody has. */
export function usernameCandidates(base: string, random: () => number = Math.random): string[] {
  const numbered = Array.from({ length: 8 }, () => `${base}${Math.floor(1000 + random() * 9000)}`)
  return [base, ...numbered]
}

/**
 * An app's roles, from its own list. Better Auth's admin plugin stores roles as text ("user", or
 * "user,admin" for several).
 *
 *   export const { ROLES, isRole, roleOf, canOpenAdmin } = defineRoles({
 *     roles: ['user', 'editor', 'admin'], defaultRole: 'user', adminPanel: ['admin'],
 *   })
 */
export function defineRoles<const R extends readonly [string, ...string[]]>(config: {
  roles: R
  defaultRole: R[number]
  /** Roles that may open the admin panel. */
  adminPanel: readonly R[number][]
}) {
  type Role = R[number]
  const known: readonly string[] = config.roles
  const panel: readonly string[] = config.adminPanel
  const isRole = (value: unknown): value is Role => typeof value === 'string' && known.includes(value)
  const split = (stored: string | null | undefined) => (stored ?? '').split(',').map((role) => role.trim())
  return {
    ROLES: config.roles,
    DEFAULT_ROLE: config.defaultRole,
    ADMIN_PANEL_ROLES: config.adminPanel,
    isRole,
    /** The role to act on: one that may open the admin panel wins, then the first known one, else the default. */
    roleOf(stored: string | null | undefined): Role {
      const roles = split(stored).filter(isRole)
      return roles.find((role) => panel.includes(role)) ?? roles[0] ?? config.defaultRole
    },
    /** True when any stored role may open the admin panel. */
    canOpenAdmin(stored: string | null | undefined): boolean {
      return split(stored).some((role) => panel.includes(role))
    },
  }
}

/**
 * The signed-in person, as every part of the app sees them. `email` is null for an account made
 * without one (its placeholder is never shown).
 */
export type AuthUser<Role extends string = string> = {
  id: string
  username: string
  name: string
  email: string | null
  image: string | null
  role: Role
}

/**
 * A profile picture's address at the size shown (twice that, for sharp screens), or '' when it can't
 * be shown: only https addresses. Google's addresses end with their size (`=s96-c`), so the size needed
 * is asked for instead of the large default.
 */
export function avatarSrc(image: string | null | undefined, px: number): string {
  if (!image) return ''
  try {
    const url = new URL(image)
    if (url.protocol !== 'https:') return ''
    if (url.hostname.endsWith('.googleusercontent.com')) return `${url.origin}${url.pathname.replace(/=[^/]*$/, '')}=s${px * 2}-c`
    return url.href
  } catch {
    return ''
  }
}

/** Up to two letters for an avatar without a picture: "Maria Lopez" or "maria_lopez" → "ML". */
export function avatarInitials(user: { name: string; username: string }): string {
  const words = (user.name.trim() || user.username)
    .replace(/[_.-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0]]
  return letters
    .map((word) => [...(word ?? '')][0] ?? '')
    .join('')
    .toUpperCase()
}
