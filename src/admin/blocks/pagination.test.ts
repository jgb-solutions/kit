import { expect, test } from 'bun:test'
import { pageWindow } from './Pagination'

test('page numbers: all of a few, else the ends and the neighbours with gaps', () => {
  expect(pageWindow(1, 3)).toEqual([1, 2, 3])
  expect(pageWindow(1, 100)).toEqual([1, 2, null, 100])
  expect(pageWindow(50, 100)).toEqual([1, null, 49, 50, 51, null, 100])
  expect(pageWindow(100, 100)).toEqual([1, null, 99, 100])
  expect(pageWindow(3, 8)).toEqual([1, 2, 3, 4, null, 8])
})
