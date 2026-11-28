import { expect, test } from 'bun:test'
import { scalePoints, smoothPath } from './LineChart'

test('points span the width, the highest at the top (with headroom), zero at the bottom', () => {
  const points = scalePoints([0, 50, 100], 400, 150, 10)
  expect(points.map(([x]) => x)).toEqual([0, 200, 400])
  expect(points[2]![1]).toBe(10)
  expect(points[0]![1]).toBe(140)
  expect(scalePoints([], 400, 150)).toEqual([])
  expect(scalePoints([5], 400, 150)[0]![0]).toBe(200)
  // All the same: a flat line, no division by zero.
  expect(scalePoints([3, 3, 3], 400, 150).every(([, y]) => Number.isFinite(y))).toBe(true)
})

test('the path starts at the first point and ends at the last', () => {
  const path = smoothPath([
    [0, 100],
    [200, 50],
    [400, 10],
  ])
  expect(path.startsWith('M0 100')).toBe(true)
  expect(path.endsWith('400 10')).toBe(true)
  expect(path.match(/C/g)).toHaveLength(2)
  expect(smoothPath([])).toBe('')
})
