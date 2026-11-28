import { useId, useState } from 'react'
import { ChartPoints } from './ChartPoints'

export type ChartPoint = { label: string; value: number }

/** Points to SVG coordinates in a width × height box, highest value at the top (with headroom). */
export function scalePoints(values: number[], width: number, height: number, pad = 12): [number, number][] {
  if (values.length === 0) return []
  const max = Math.max(...values)
  const min = Math.min(0, ...values)
  const range = max - min || 1
  const step = values.length > 1 ? width / (values.length - 1) : 0
  return values.map((value, i) => [values.length > 1 ? i * step : width / 2, pad + (1 - (value - min) / range) * (height - pad * 2)])
}

/** A smooth path through the points (Catmull-Rom as cubic Béziers), never overshooting in x. */
export function smoothPath(points: [number, number][]): string {
  if (points.length === 0) return ''
  const [first] = points as [[number, number]]
  if (points.length === 1) return `M${first[0]} ${first[1]}`
  let d = `M${round(first[0])} ${round(first[1])}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!
    const p1 = points[i]!
    const p2 = points[i + 1]!
    const p3 = points[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${round(c1[0]!)} ${round(c1[1]!)} ${round(c2[0]!)} ${round(c2[1]!)} ${round(p2[0])} ${round(p2[1])}`
  }
  return d
}

const round = (n: number) => Math.round(n * 10) / 10

export type LineChartProps = {
  data: ChartPoint[]
  /** What the chart shows, for screen readers ("Visits per day this week"). A table of the values follows it. */
  label: string
  /** The line's colour: the kit's sun (default, for the dark hero) or the brand. */
  color?: 'sun' | 'brand'
  height?: number
  /** How values read in the table for screen readers. */
  format?: (value: number) => string
}

/**
 * One series as a smooth line with a fading fill and the last point marked, day labels underneath.
 * Each value shows on hover, and from the keyboard (Tab to the chart, then the arrow keys).
 * SVG, no chart library; it stretches to its tile's width.
 */
export function LineChart({ data, label, color = 'sun', height = 150, format = (v) => v.toLocaleString('en-US') }: LineChartProps) {
  const id = useId()
  const width = 400
  const points = scalePoints(
    data.map((point) => point.value),
    width,
    height,
  )
  const line = smoothPath(points)
  const [active, setActive] = useState<number | null>(null)
  const shown = active === null ? points[points.length - 1] : points[active]
  const stroke = color === 'sun' ? 'var(--sun)' : 'var(--brand)'
  return (
    <figure className="ja-chart">
      <div className="ja-chart-plot">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" width="100%" height={height} role="img" aria-label={label}>
          <defs>
            <linearGradient id={`${id}-fade`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={stroke} stopOpacity="0.35" />
              <stop offset="1" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          {points.length > 1 && <path d={`${line} L${width} ${height} L0 ${height} Z`} fill={`url(#${id}-fade)`} />}
          <path d={line} fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* The last point (or the one hovered or focused), in HTML so it stays round while the SVG stretches. */}
        {active !== null && shown && <span className="ja-chart-guide" style={{ left: `${(shown[0] / width) * 100}%` }} />}
        {shown && (
          <span
            className="ja-chart-dot"
            style={{ left: `${(shown[0] / width) * 100}%`, top: `${(shown[1] / height) * 100}%`, background: stroke }}
          />
        )}
        <ChartPoints
          names={data.map((point) => `${point.label}: ${format(point.value)}`)}
          centers={points.map(([x]) => (x / width) * 100)}
          width={100 / Math.max(1, data.length - 1)}
          active={active}
          onActive={setActive}
          tipTop={(i) => ((points[i]?.[1] ?? 0) / height) * 100}
          tip={(i) => (
            <>
              <span>{data[i]?.label}</span>
              <strong>{format(data[i]?.value ?? 0)}</strong>
            </>
          )}
        />
      </div>
      <div className="ja-chart-labels" aria-hidden="true">
        {data.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
      {/* In a div: a table ignores the 1px box and its overflow, so as .ja-sr itself it stretched the page. */}
      <div className="ja-sr">
        <table>
          <caption>{label}</caption>
          <tbody>
            {data.map((point) => (
              <tr key={point.label}>
                <th scope="row">{point.label}</th>
                <td>{format(point.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
