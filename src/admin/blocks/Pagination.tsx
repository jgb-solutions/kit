import { useId } from 'react'
import { icons } from '../icons'

/** The rows-per-page choices a list offers by default. */
export const PAGE_SIZES = [25, 50, 100, 200] as const

export type PageSizeProps = {
  value: number
  onChange: (size: number) => void
  options?: readonly number[] | undefined
  label?: string | undefined
}

/**
 * "Rows per page": a native select. The app keeps the size (e.g. ?per=50 in the URL) and goes back to
 * the first page when it changes. Sits in Pagination, or beside an app's own pager (keyset "Next page").
 */
export function PageSize({ value, onChange, options = PAGE_SIZES, label = 'Rows per page' }: PageSizeProps) {
  const id = useId()
  return (
    <div className="ja-page-size">
      <label htmlFor={id}>{label}</label>
      <span className="ja-select-wrap">
        <select id={id} className="ja-select" value={value} onChange={(event) => onChange(Number(event.target.value))}>
          {options.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <icons.chevronDown />
      </span>
    </div>
  )
}

/** Which page numbers to show: the first, the last, and the current one's neighbours; null is a gap. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const near = [page - 1, page, page + 1].filter((p) => p > 1 && p < pages)
  const list: (number | null)[] = [1]
  if (near[0]! > 2) list.push(null)
  list.push(...near)
  if (near[near.length - 1]! < pages - 1) list.push(null)
  list.push(pages)
  return list
}

export type PaginationProps = {
  page: number
  pages: number
  onPage: (page: number) => void
  /** "1–4 of 2,481 people": shown on desktop. */
  summary?: string | undefined
  /** What is paged, for the navigation's name ("People pages"). */
  label?: string | undefined
  /** Rows per page: with `onPageSize`, a "Rows per page" choice shows beside the pages. */
  pageSize?: number | undefined
  onPageSize?: ((size: number) => void) | undefined
  pageSizes?: readonly number[] | undefined
}

/** Page numbers with a next button; the current page is marked for screen readers. */
export function Pagination({ page, pages, onPage, summary, label = 'Pages', pageSize, onPageSize, pageSizes }: PaginationProps) {
  const sized = pageSize !== undefined && onPageSize !== undefined
  if (pages <= 1 && !summary && !sized) return null
  return (
    <div className="ja-pager">
      <span>{summary}</span>
      {sized && <PageSize value={pageSize} onChange={onPageSize} options={pageSizes} />}
      {pages > 1 && (
        <nav aria-label={label}>
          <ul className="ja-pages">
            {page > 1 && (
              <li>
                <button type="button" aria-label="Previous page" onClick={() => onPage(page - 1)}>
                  <icons.chevronLeft />
                </button>
              </li>
            )}
            {pageWindow(page, pages).map((p, i) =>
              p === null ? (
                <li key={`gap-${i}`} aria-hidden="true" className="ja-muted" style={{ alignSelf: 'center' }}>
                  …
                </li>
              ) : (
                <li key={p}>
                  <button
                    type="button"
                    aria-current={p === page ? 'page' : undefined}
                    aria-label={`Page ${p}`}
                    onClick={() => p !== page && onPage(p)}
                  >
                    {p}
                  </button>
                </li>
              ),
            )}
            {page < pages && (
              <li>
                <button type="button" aria-label="Next page" onClick={() => onPage(page + 1)}>
                  <icons.chevronRight />
                </button>
              </li>
            )}
          </ul>
        </nav>
      )}
    </div>
  )
}
