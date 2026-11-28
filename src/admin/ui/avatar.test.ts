import { expect, test } from 'bun:test'
import { contrastRatio } from '../contrast'
import { initials, toneOf } from './Avatar'

test('initials: first and last word, one letter for one word', () => {
  expect(initials('Priya Nair')).toBe('PN')
  expect(initials('  maya  ')).toBe('M')
  expect(initials('Jean Gérard Bousiquot')).toBe('JB')
  expect(initials('élodie')).toBe('É')
})

test('a name keeps its colour, and every colour pair meets AA', () => {
  expect(toneOf('Priya Nair')).toEqual(toneOf('Priya Nair'))
  const names = ['Priya Nair', 'Jonas Lind', 'Ada Okafor', 'Leo Martin', 'Maya Reyes', 'Sam', 'Kim', 'Zoë']
  for (const name of names) {
    const [background, color] = toneOf(name)
    expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(4.5)
  }
})
