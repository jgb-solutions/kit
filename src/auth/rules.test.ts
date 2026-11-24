import { describe, expect, test } from 'bun:test'
import {
  avatarInitials,
  avatarSrc,
  defineRoles,
  isPlaceholderEmail,
  placeholderEmail,
  usernameCandidates,
  usernameFromName,
  usernameProblem,
} from './rules'

describe('usernames', () => {
  test('usernameProblem follows the username plugin rule', () => {
    expect(usernameProblem('maria')).toBeNull()
    expect(usernameProblem('ma')).toBe('too-short')
    expect(usernameProblem('a'.repeat(31))).toBe('too-long')
    expect(usernameProblem('Maria!')).toBe('characters')
  })

  test('usernameFromName drops accents, joins words with dots, keeps room for a number', () => {
    expect(usernameFromName('Marie-Ève Dupont', null, 'member')).toBe('marie.eve.dupont')
    expect(usernameFromName('  ', 'jo.smith+tag@example.com', 'member')).toBe('jo.smithtag')
    expect(usernameFromName('李', 'x@example.com', 'listener')).toBe('listener')
    expect(usernameFromName('A'.repeat(60), null, 'member').length).toBe(25)
  })

  test('usernameCandidates: the name, then 8 numbered ones', () => {
    const candidates = usernameCandidates('maria', () => 0.5)
    expect(candidates).toHaveLength(9)
    expect(candidates[0]).toBe('maria')
    expect(candidates[1]).toBe('maria5500')
  })
})

describe('placeholder emails', () => {
  test('are recognised and never collide', () => {
    const a = placeholderEmail()
    expect(isPlaceholderEmail(a)).toBe(true)
    expect(isPlaceholderEmail(a.toUpperCase())).toBe(true)
    expect(a).not.toBe(placeholderEmail())
    expect(isPlaceholderEmail('ana@example.com')).toBe(false)
  })
})

describe('defineRoles', () => {
  const roles = defineRoles({ roles: ['user', 'editor', 'admin'], defaultRole: 'user', adminPanel: ['admin'] })

  test('roleOf: an admin-panel role wins, then the first known one, else the default', () => {
    expect(roles.roleOf('user,admin')).toBe('admin')
    expect(roles.roleOf('editor, user')).toBe('editor')
    expect(roles.roleOf('ghost')).toBe('user')
    expect(roles.roleOf(null)).toBe('user')
  })

  test('canOpenAdmin and isRole', () => {
    expect(roles.canOpenAdmin('user, admin')).toBe(true)
    expect(roles.canOpenAdmin('editor')).toBe(false)
    expect(roles.isRole('editor')).toBe(true)
    expect(roles.isRole('root')).toBe(false)
  })
})

describe('avatars', () => {
  test('avatarSrc: https only, Google pictures at the size shown', () => {
    expect(avatarSrc('https://lh3.googleusercontent.com/a/abc=s96-c', 36)).toBe('https://lh3.googleusercontent.com/a/abc=s72-c')
    expect(avatarSrc('https://example.com/me.png', 36)).toBe('https://example.com/me.png')
    expect(avatarSrc('http://example.com/me.png', 36)).toBe('')
    expect(avatarSrc('javascript:alert(1)', 36)).toBe('')
    expect(avatarSrc(null, 36)).toBe('')
  })

  test('avatarInitials', () => {
    expect(avatarInitials({ name: 'Maria Lopez', username: 'x' })).toBe('ML')
    expect(avatarInitials({ name: '', username: 'maria_lopez' })).toBe('ML')
    expect(avatarInitials({ name: 'Ana', username: 'ana' })).toBe('A')
  })
})
