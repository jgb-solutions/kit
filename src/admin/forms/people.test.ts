import { expect, test } from 'bun:test'
import { articleFor } from './People'

test('a or an, by the first letter', () => {
  expect(articleFor('Admin')).toBe('an')
  expect(articleFor('Editor')).toBe('an')
  expect(articleFor('Member')).toBe('a')
})
