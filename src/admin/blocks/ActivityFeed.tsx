import type { ReactNode } from 'react'

export type Activity = {
  id: string
  icon: ReactNode
  tone?: 'brand' | 'good' | 'warn' | 'bad' | undefined
  /** The sentence: who did what ("Jonas Lind published “Spring menu”"). */
  text: ReactNode
  /** When, as people say it ("12 minutes ago"); `datetime` is the machine-readable time. */
  time: string
  datetime?: string | undefined
  /** The day group it belongs to ("Today", "Yesterday"); consecutive items share one heading. */
  day?: string | undefined
}

export type ActivityFeedProps = {
  items: Activity[]
  loading?: boolean | undefined
  empty?: ReactNode
}

/** What happened lately: an icon, a sentence and a time, grouped by day. */
export function ActivityFeed({ items, loading = false, empty = 'Nothing has happened yet.' }: ActivityFeedProps) {
  if (loading)
    return (
      <ol className="ja-feed" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="ja-feed-item" aria-hidden="true">
            <span className="ja-feed-icon" />
            <span style={{ flex: 1, display: 'grid', gap: 8 }}>
              <span className="ja-skeleton" style={{ width: `${70 - i * 12}%` }} />
              <span className="ja-skeleton" style={{ width: '30%', height: 10 }} />
            </span>
          </li>
        ))}
      </ol>
    )
  if (items.length === 0) return <p className="ja-empty">{empty}</p>
  return (
    <ol className="ja-feed">
      {items.map((item, i) => (
        <li key={item.id} style={{ display: 'contents' }}>
          {item.day && item.day !== items[i - 1]?.day && <div className="ja-feed-day">{item.day}</div>}
          <div className="ja-feed-item">
            <span className="ja-feed-icon" data-tone={item.tone && item.tone !== 'brand' ? item.tone : undefined} aria-hidden="true">
              {item.icon}
            </span>
            <span>
              {item.text}
              <small>{item.datetime ? <time dateTime={item.datetime}>{item.time}</time> : item.time}</small>
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}
