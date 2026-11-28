import { describe, expect, test } from 'bun:test'
import { nextPoint } from './ChartPoints'

describe('nextPoint', () => {
  test('arrows move one point and stop at the ends', () => {
    expect(nextPoint('ArrowRight', 2, 7)).toBe(3)
    expect(nextPoint('ArrowLeft', 2, 7)).toBe(1)
    expect(nextPoint('ArrowRight', 6, 7)).toBe(6)
    expect(nextPoint('ArrowLeft', 0, 7)).toBe(0)
  })
  test('Home and End jump to the first and last points', () => {
    expect(nextPoint('Home', 4, 7)).toBe(0)
    expect(nextPoint('End', 1, 7)).toBe(6)
  })
  test('other keys and empty charts are left alone', () => {
    expect(nextPoint('Enter', 2, 7)).toBeNull()
    expect(nextPoint('ArrowRight', 0, 0)).toBeNull()
  })
})
