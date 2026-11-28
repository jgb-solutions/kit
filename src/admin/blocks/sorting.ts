/** Table sorting: which column, which way. The app keeps it (e.g. in the URL's search params). */
export type SortDirection = 'asc' | 'desc'
export type TableSort = { key: string; direction: SortDirection }

/** How a column sorts. */
export type ColumnSort<Row> = {
  /** Compares two rows, ascending: needed when the table sorts the rows itself (`sortRows`). */
  compare?: ((a: Row, b: Row) => number) | undefined
  /** The direction of a first click: "desc" for numbers people want biggest first. Default "asc". */
  first?: SortDirection | undefined
  /** The column's name in the phone's "Sort by" list, when the header isn't plain text. */
  label?: string | undefined
  /** How each direction reads there ("A to Z", "Most first"). Default "ascending" / "descending". */
  ascLabel?: string | undefined
  descLabel?: string | undefined
}

/** The sort after a click on a column's header: the other way on the sorted column, else its first direction. */
export function nextSort(current: TableSort | undefined, key: string, first: SortDirection = 'asc'): TableSort {
  if (current?.key === key) return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  return { key, direction: first }
}

/** The rows in the sort's order (a stable copy), with the column's `compare`; unchanged when there's none. */
export function sortRows<Row>(rows: readonly Row[], compare: ((a: Row, b: Row) => number) | undefined, direction: SortDirection): Row[] {
  if (!compare) return [...rows]
  const sign = direction === 'asc' ? 1 : -1
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => sign * compare(a.row, b.row) || a.index - b.index)
    .map(({ row }) => row)
}

/** Compares text the way people read it (case and accents aside, "item 2" before "item 10"). */
export const byText =
  <Row>(value: (row: Row) => string) =>
  (a: Row, b: Row) =>
    value(a).localeCompare(value(b), undefined, { numeric: true, sensitivity: 'base' })

/** Compares numbers; a missing one (null) counts as the smallest. */
export const byNumber =
  <Row>(value: (row: Row) => number | null) =>
  (a: Row, b: Row) => {
    const x = value(a)
    const y = value(b)
    if (x === null || y === null) return x === y ? 0 : x === null ? -1 : 1
    return x - y
  }

/** The phone's "Sort by" value for a sort, and back. */
export const sortValue = (sort: TableSort) => `${sort.key}:${sort.direction}`
export function parseSortValue(value: string): TableSort | undefined {
  const at = value.lastIndexOf(':')
  const direction = value.slice(at + 1)
  if (at <= 0 || (direction !== 'asc' && direction !== 'desc')) return undefined
  return { key: value.slice(0, at), direction }
}
