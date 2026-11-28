import { describe, expect, test } from 'bun:test'
import { nextIndex } from './ThemeToggle'

describe('the theme switch keys (radio pattern)', () => {
  test('arrows move and wrap around, Home and End jump', () => {
    expect(nextIndex('ArrowRight', 0, 3)).toBe(1)
    expect(nextIndex('ArrowDown', 2, 3)).toBe(0)
    expect(nextIndex('ArrowLeft', 0, 3)).toBe(2)
    expect(nextIndex('ArrowUp', 1, 3)).toBe(0)
    expect(nextIndex('Home', 2, 3)).toBe(0)
    expect(nextIndex('End', 0, 3)).toBe(2)
  })
  test('other keys are left alone', () => {
    expect(nextIndex('Tab', 1, 3)).toBeNull()
    expect(nextIndex('a', 1, 3)).toBeNull()
  })
})
