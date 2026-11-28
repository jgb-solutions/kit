import type { ReactNode } from 'react'
import { Avatar } from '../ui/Avatar'
import { Tile, type TileProps } from './Tile'

/** A change against the last period: "+12.4%", up or down, and whether that's good news. */
export type Delta = { value: string; direction: 'up' | 'down'; good?: boolean | undefined; label?: string | undefined }

/** "+12.4% on last week": coloured by whether the change is good (up isn't always good). */
export function DeltaText({ delta }: { delta: Delta }) {
  const good = delta.good ?? delta.direction === 'up'
  return (
    <span className="ja-delta" data-good={good ? 'true' : 'false'}>
      <span className="ja-sr">{delta.direction === 'up' ? 'Up ' : 'Down '}</span>
      {delta.value}
      {delta.label && <span className="ja-label"> {delta.label}</span>}
    </span>
  )
}

/** A rounded bar: a share of something (0 to 1). Its label says what, for screen readers. */
export function Meter({ value, label }: { value: number; label: string }) {
  const share = Math.min(1, Math.max(0, value))
  return (
    <div className="ja-meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
      <span style={{ width: `${share * 100}%` }} />
    </div>
  )
}

/** A few faces, then "+313": who is behind a number. */
export function AvatarStack({ names, more = 0, label }: { names: string[]; more?: number; label: string }) {
  return (
    <div className="ja-avatar-stack" role="img" aria-label={label}>
      {names.slice(0, 4).map((name) => (
        <Avatar key={name} name={name} size={30} />
      ))}
      {more > 0 && (
        <span className="ja-more" aria-hidden="true">
          +{more.toLocaleString('en-US')}
        </span>
      )}
    </div>
  )
}

export type StatTileProps = Omit<TileProps, 'title' | 'children'> & {
  label: ReactNode
  value: ReactNode
  delta?: Delta | undefined
  /** A line under the number ("Busiest day: Thursday, 22 pages"). */
  note?: ReactNode
  /** Something under the number: a Meter or an AvatarStack. */
  children?: ReactNode
}

/** A label, a big number, and its context: a delta, a note, a meter or faces. */
export function StatTile({ label, value, delta, note, children, span = 3, ...tile }: StatTileProps) {
  return (
    <Tile span={span} {...tile}>
      <div className="ja-label">{label}</div>
      <div className="ja-number">{value}</div>
      {children}
      {(note || delta) && (
        <p className="ja-note">
          {note}
          {note && delta && ', '}
          {delta && <DeltaText delta={delta} />}
        </p>
      )}
    </Tile>
  )
}
