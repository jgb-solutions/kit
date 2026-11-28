import { useState, type KeyboardEvent, type ReactNode } from 'react'

/** Where the next point is after a key press, or null for keys the chart leaves alone. */
export function nextPoint(key: string, current: number, count: number): number | null {
  if (count === 0) return null
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return Math.min(count - 1, current + 1)
    case 'ArrowLeft':
    case 'ArrowUp':
      return Math.max(0, current - 1)
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

/** A point's hover area: centred on it, and kept inside the plot. */
function areaStyle(center: number, width: number) {
  const left = Math.max(0, center - width / 2)
  const right = Math.min(100, center + width / 2)
  return { left: `${left}%`, width: `${right - left}%` }
}

export type ChartPointsProps = {
  /** One accessible name per point or group ("Thu: 7,300"). */
  names: string[]
  /** Each point's centre, as a % of the plot's width. */
  centers: number[]
  /** The width of each hover area, as a % of the plot's width. */
  width: number
  /** The point shown (hovered or focused), or null. */
  active: number | null
  onActive: (index: number | null) => void
  /** The tooltip's top, as a % of the plot's height, for the active point. */
  tipTop: (index: number) => number
  /** What the tooltip says for the active point. */
  tip: (index: number) => ReactNode
}

/**
 * The values on hover and from the keyboard: one tab stop per chart, arrow keys (and Home, End)
 * move between points, and a tooltip shows the active one. Each point is named for screen
 * readers, and the chart's table of values stays for those who prefer it.
 */
export function ChartPoints({ names, centers, width, active, onActive, tipTop, tip }: ChartPointsProps) {
  // The point that takes Tab: the last one, until the reader moves.
  const [stop, setStop] = useState(names.length - 1)
  const tabStop = Math.min(stop, names.length - 1)

  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>, index: number) => {
    const next = nextPoint(event.key, index, names.length)
    if (next === null) return
    event.preventDefault()
    setStop(next)
    const sibling = event.currentTarget.parentElement?.children[next]
    if (sibling instanceof HTMLElement) sibling.focus()
  }

  // The tooltip sits above the point, or beside it when the point is near the top (so it never
  // covers the tallest bars or leaves the tile).
  const center = active === null ? 0 : (centers[active] ?? 0)
  const top = active === null ? 0 : tipTop(active)
  const beside = top < 32
  const toStart = center > 60
  const offset = Math.min(width / 2, 6)
  const tipLeft = beside ? center + (toStart ? -offset : offset) : center
  const side = beside ? (toStart ? 'before' : 'after') : center < 18 ? 'start' : center > 82 ? 'end' : undefined
  return (
    <>
      <div className="ja-chart-points" onPointerLeave={() => onActive(null)}>
        {names.map((name, i) => (
          <span
            key={name}
            role="img"
            aria-label={name}
            tabIndex={i === tabStop ? 0 : -1}
            className="ja-chart-point"
            data-active={i === active || undefined}
            style={areaStyle(centers[i] ?? 0, width)}
            onPointerEnter={() => onActive(i)}
            onFocus={() => {
              setStop(i)
              onActive(i)
            }}
            onBlur={() => onActive(null)}
            onKeyDown={(event) => onKeyDown(event, i)}
          />
        ))}
      </div>
      {active !== null && (
        <div
          className="ja-chart-tip"
          aria-hidden="true"
          data-side={side}
          style={{ left: `${tipLeft}%`, top: `${beside ? Math.max(top, 4) : top}%` }}
        >
          {tip(active)}
        </div>
      )}
    </>
  )
}
