import type { ReactNode } from 'react'

export type StatusTone = 'good' | 'warn' | 'bad' | 'neutral'

/** The usual people statuses, worded and coloured; any other status passes its own tone. */
export const PEOPLE_STATUS = {
  active: { label: 'Active', tone: 'good' },
  invited: { label: 'Invited', tone: 'warn' },
  suspended: { label: 'Suspended', tone: 'bad' },
} as const satisfies Record<string, { label: string; tone: StatusTone }>

/** A dot and a word in the status colour: "Active", "Invited", "Suspended". */
export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className="ja-status" data-tone={tone}>
      {children}
    </span>
  )
}
