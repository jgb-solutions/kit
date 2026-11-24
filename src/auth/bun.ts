/**
 * Passwords hashed with Bun's built-in argon2id, for apps that run on Bun (not on Cloudflare Workers,
 * which keep Better Auth's scrypt). A hash is only ever checked by the host that made it.
 *
 *   import { argon2idHasher } from '@jgb-solutions/kit/auth/bun'
 *   standardAuthOptions({ …, password: argon2idHasher() })
 */
import type { PasswordHasher } from '../auth'

/**
 * The part of Bun's global this module uses, declared here so the published types don't need
 * `@types/bun` (this module still only runs on Bun).
 */
declare const Bun: {
  password: {
    hash(password: string, options: { algorithm: 'argon2id'; memoryCost?: number; timeCost?: number }): Promise<string>
    verify(password: string, hash: string): Promise<boolean>
  }
}

/**
 * Bun.password with argon2id, Bun's default cost unless one is given. The settings are stored in each
 * hash, so changing them never breaks existing passwords.
 */
export function argon2idHasher(options: { memoryCost?: number; timeCost?: number } = {}): PasswordHasher {
  const algorithm = { algorithm: 'argon2id' as const, ...options }
  return {
    hash: (password) => Bun.password.hash(password, algorithm),
    verify: ({ hash, password }) => Bun.password.verify(password, hash).catch(() => false),
  }
}
