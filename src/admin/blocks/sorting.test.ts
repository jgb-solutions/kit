import { describe, expect, test } from 'bun:test'
import { byNumber, byText, nextSort, parseSortValue, sortRows, sortValue } from './sorting'

describe('table sorting', () => {
  test('a header click: the other way on the sorted column, else the column’s first direction', () => {
    expect(nextSort(undefined, 'name')).toEqual({ key: 'name', direction: 'asc' })
    expect(nextSort({ key: 'name', direction: 'asc' }, 'name')).toEqual({ key: 'name', direction: 'desc' })
    expect(nextSort({ key: 'name', direction: 'desc' }, 'name')).toEqual({ key: 'name', direction: 'asc' })
    expect(nextSort({ key: 'name', direction: 'asc' }, 'views', 'desc')).toEqual({ key: 'views', direction: 'desc' })
  })

  test('rows sort by text as people read it, and keep their order on ties', () => {
    const rows = [
      { id: 1, name: 'item 10' },
      { id: 2, name: 'Élan' },
      { id: 3, name: 'item 2' },
      { id: 4, name: 'elan' },
    ]
    expect(
      sortRows(
        rows,
        byText((r) => r.name),
        'asc',
      ).map((r) => r.id),
    ).toEqual([2, 4, 3, 1])
    expect(
      sortRows(
        rows,
        byText((r) => r.name),
        'desc',
      ).map((r) => r.id),
    ).toEqual([1, 3, 2, 4])
    // A copy: the rows passed in stay as they were.
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3, 4])
  })

  test('numbers sort as numbers, a missing one counts as the smallest', () => {
    const rows = [{ n: 10 }, { n: null }, { n: 2 }]
    expect(
      sortRows(
        rows,
        byNumber((r) => r.n),
        'asc',
      ).map((r) => r.n),
    ).toEqual([null, 2, 10])
    expect(
      sortRows(
        rows,
        byNumber((r) => r.n),
        'desc',
      ).map((r) => r.n),
    ).toEqual([10, 2, null])
  })

  test('without a compare (the server sorted), rows stay in order', () => {
    expect(sortRows([3, 1, 2], undefined, 'desc')).toEqual([3, 1, 2])
  })

  test('the phone list’s values', () => {
    expect(sortValue({ key: 'joined', direction: 'desc' })).toBe('joined:desc')
    expect(parseSortValue('joined:desc')).toEqual({ key: 'joined', direction: 'desc' })
    expect(parseSortValue('a:b:asc')).toEqual({ key: 'a:b', direction: 'asc' })
    expect(parseSortValue('joined')).toBeUndefined()
    expect(parseSortValue(':asc')).toBeUndefined()
  })
})
