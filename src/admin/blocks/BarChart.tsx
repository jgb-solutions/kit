import { useId, useState } from 'react'
import { ChartPoints } from './ChartPoints'

export type BarSeries = { label: string; values: number[] }

export type BarChartProps = {
  /** The category under each bar group ("Mon", "Tue"…). */
  labels: string[]
  /** One series, or two: this period first, the last one second (drawn lighter, beside it). */
  series: [BarSeries] | [BarSeries, BarSeries]
  /** What the chart shows, for screen readers ("Sign-ups per day, this week and last"). */
  label: string
  height?: number
  format?: (value: number) => string
}

/** Bars, rounded at the top, scaled from zero; equal gaps; the tallest value at the top. */
export function barLayout(groups: number, perGroup: number, width: number, gap = 0.28) {
  const group = width / Math.max(groups, 1)
  const inner = group * (1 - gap)
  const bar = inner / perGroup
  return { group, bar, offset: (group - inner) / 2 }
}

/**
 * One or two series as bars (this period against the last), with a legend for two and a table of
 * the values for screen readers. Each group's values show on hover, and from the keyboard (Tab to
 * the chart, then the arrow keys). SVG, no chart library; it stretches to its tile's width.
 */
export function BarChart({ labels, series, label, height = 180, format = (v) => v.toLocaleString('en-US') }: BarChartProps) {
  const id = useId()
  const width = 400
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  const { group, bar, offset } = barLayout(labels.length, series.length, width)
  const fills = ['var(--brand)', 'color-mix(in oklab, var(--brand) 32%, var(--tile))']
  const [active, setActive] = useState<number | null>(null)
  const barHeight = (value: number) => (Math.max(0, value) / max) * (height - 4)
  const groupTop = (g: number) => height - Math.max(...series.map((s) => barHeight(s.values[g] ?? 0)))
  return (
    <figure className="ja-chart">
      {series.length === 2 && (
        <div className="ja-legend" aria-hidden="true">
          {series.map((s, i) => (
            <span key={s.label}>
              <i style={{ background: fills[i] }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div className="ja-chart-plot">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" width="100%" height={height} role="img" aria-label={label}>
          {labels.map((name, g) =>
            series.map((s, i) => {
              const value = s.values[g] ?? 0
              const h = barHeight(value)
              return (
                <rect
                  key={`${id}-${name}-${s.label}`}
                  x={g * group + offset + i * bar + 1}
                  y={height - h}
                  width={Math.max(1, bar - 2)}
                  height={h}
                  rx={Math.min(6, bar / 3)}
                  fill={fills[i]}
                  opacity={active === null || active === g ? 1 : 0.45}
                />
              )
            }),
          )}
        </svg>
        <ChartPoints
          names={labels.map(
            (name, g) =>
              `${name}: ${series.map((s) => (series.length > 1 ? `${s.label} ${format(s.values[g] ?? 0)}` : format(s.values[g] ?? 0))).join(', ')}`,
          )}
          centers={labels.map((_, g) => ((g + 0.5) * group * 100) / width)}
          width={(group * 100) / width}
          active={active}
          onActive={setActive}
          tipTop={(g) => (groupTop(g) / height) * 100}
          tip={(g) => (
            <>
              <span>{labels[g]}</span>
              {series.map((s, i) => (
                <strong key={s.label}>
                  {series.length > 1 && <i style={{ background: fills[i] }} />}
                  {format(s.values[g] ?? 0)}
                </strong>
              ))}
            </>
          )}
        />
      </div>
      <div className="ja-chart-labels ja-bar-labels" aria-hidden="true">
        {labels.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
      {/* In a div: a table ignores the 1px box and its overflow, so as .ja-sr itself it stretched the page. */}
      <div className="ja-sr">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <td />
              {series.map((s) => (
                <th key={s.label} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((name, g) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                {series.map((s) => (
                  <td key={s.label}>{format(s.values[g] ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
