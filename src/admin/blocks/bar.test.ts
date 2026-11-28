import { expect, test } from 'bun:test'
import { barLayout } from './BarChart'

test('bars share each group evenly, centred, with a gap between groups', () => {
  const one = barLayout(4, 1, 400)
  expect(one.group).toBe(100)
  expect(one.bar).toBeCloseTo(72)
  expect(one.offset).toBeCloseTo(14)
  const two = barLayout(4, 2, 400)
  expect(two.bar * 2 + two.offset * 2).toBeCloseTo(100)
  expect(barLayout(0, 1, 400).group).toBe(400)
})
