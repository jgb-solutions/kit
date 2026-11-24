import { expect, test } from 'bun:test'
import { argon2idHasher } from './bun'

test('argon2id hashes and verifies; a bad hash is a wrong password, not a crash', async () => {
  const hasher = argon2idHasher({ memoryCost: 4096, timeCost: 1 })
  const hash = await hasher.hash('correct horse battery')
  expect(hash.startsWith('$argon2id$')).toBe(true)
  expect(await hasher.verify({ hash, password: 'correct horse battery' })).toBe(true)
  expect(await hasher.verify({ hash, password: 'wrong' })).toBe(false)
  expect(await hasher.verify({ hash: 'not-a-hash', password: 'x' })).toBe(false)
})

test('fallbackVerify checks older hashes; new passwords are argon2id', async () => {
  const { hashPassword, verifyPassword } = await import('better-auth/crypto')
  const old = await hashPassword('correct horse battery')
  const hasher = argon2idHasher({ memoryCost: 4096, timeCost: 1, fallbackVerify: verifyPassword })
  expect(old.startsWith('$argon2')).toBe(false)
  expect(await hasher.verify({ hash: old, password: 'correct horse battery' })).toBe(true)
  expect(await hasher.verify({ hash: old, password: 'wrong password' })).toBe(false)
  expect((await hasher.hash('new password here')).startsWith('$argon2id$')).toBe(true)
})
