import type { ReactNode } from 'react'
import { LineChart, type ChartPoint } from './LineChart'
import { SegmentedControl, type SegmentedOption } from './Segmented'
import { DeltaText, type Delta } from './Stat'
import { Tile, type TileProps } from './Tile'

export type HeroChartTileProps<P extends string> = Omit<TileProps, 'title' | 'children' | 'tone'> & {
  label: ReactNode
  value: ReactNode
  delta?: Delta | undefined
  data: ChartPoint[]
  /** What the chart shows, for screen readers ("Visits per day this week"). */
  chartLabel: string
  /** The period switch (Day / Week / Month), when the app offers one. */
  periods?: { label: string; options: readonly SegmentedOption<P>[]; value: P; onChange: (value: P) => void } | undefined
}

/** The page's main number: a dark tile with the number, its delta, a period switch and a line chart. */
export function HeroChartTile<P extends string>({
  label,
  value,
  delta,
  data,
  chartLabel,
  periods,
  span = 5,
  rowSpan = 2,
  className,
  ...tile
}: HeroChartTileProps<P>) {
  return (
    <Tile span={span} rowSpan={rowSpan} tone="night" className={className ? `ja-hero ${className}` : 'ja-hero'} {...tile}>
      <div className="ja-tile-head" style={{ marginBottom: 0 }}>
        <span className="ja-label">{label}</span>
        {periods && <SegmentedControl label={periods.label} options={periods.options} value={periods.value} onChange={periods.onChange} />}
      </div>
      <div className="ja-number">{value}</div>
      {delta && (
        <span>
          <DeltaText delta={delta} />
        </span>
      )}
      <div className="ja-hero-chart">
        <LineChart data={data} label={chartLabel} />
      </div>
    </Tile>
  )
}
