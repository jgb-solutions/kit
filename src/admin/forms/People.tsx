import { useState } from 'react'
import { icons } from '../icons'
import { ConfirmDialog } from './ConfirmDialog'
import { TextArea } from './Field'

export type RoleOption<R extends string> = { value: R; label: string }

export type RolePickerProps<R extends string> = {
  /** Whose role it is: names the control ("Role for Priya Nair"). */
  name: string
  roles: readonly RoleOption<R>[]
  value: R
  /** Applies the new role (the app calls its server); the picker waits for it. */
  onChange: (role: R) => Promise<void> | void
  /** Roles that need a confirmation first (making someone an admin), with what it means. */
  confirm?: Partial<Record<R, string>> | undefined
  disabled?: boolean | undefined
}

/** An inline role select for a table row. Risky roles ask first. */
export function RolePicker<R extends string>({ name, roles, value, onChange, confirm, disabled }: RolePickerProps<R>) {
  const [pending, setPending] = useState<R | null>(null)
  const [busy, setBusy] = useState(false)
  const apply = async (role: R) => {
    setBusy(true)
    try {
      await onChange(role)
    } finally {
      setBusy(false)
      setPending(null)
    }
  }
  const label = (role: R) => roles.find((r) => r.value === role)?.label ?? role
  return (
    <>
      <span className="ja-select-wrap ja-select-inline">
        <select
          className="ja-select"
          aria-label={`Role for ${name}`}
          value={value}
          disabled={disabled || busy}
          onChange={(event) => {
            const role = event.target.value as R
            if (confirm?.[role]) setPending(role)
            else void apply(role)
          }}
        >
          {roles.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
        <icons.chevronDown />
      </span>
      {pending && (
        <ConfirmDialog
          open
          title={`Make ${name} ${articleFor(label(pending))} ${label(pending)}?`}
          description={confirm?.[pending]}
          confirmLabel={`Make ${name} ${articleFor(label(pending))} ${label(pending)}`}
          busy={busy}
          onConfirm={() => void apply(pending)}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  )
}

/** "an Admin", "an Editor", "a Member". */
export function articleFor(word: string): 'a' | 'an' {
  return /^[aeiou]/i.test(word) ? 'an' : 'a'
}

export type BanControlProps = {
  name: string
  suspended: boolean
  /** Suspends, with the reason the admin gave (optional). */
  onSuspend: (reason: string) => Promise<void> | void
  onRestore: () => Promise<void> | void
}

/** Suspend (with a reason, after a confirmation) or restore a person, from their row. */
export function BanControl({ name, suspended, onSuspend, onRestore }: BanControlProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async (action: () => Promise<void> | void) => {
    setBusy(true)
    try {
      await action()
      setOpen(false)
      setReason('')
    } finally {
      setBusy(false)
    }
  }
  if (suspended)
    return (
      <button type="button" className="ja-row-action" aria-label={`Restore ${name}`} disabled={busy} onClick={() => void run(onRestore)}>
        Restore
      </button>
    )
  return (
    <>
      <button type="button" className="ja-row-action" data-variant="danger" aria-label={`Suspend ${name}`} onClick={() => setOpen(true)}>
        Suspend
      </button>
      <ConfirmDialog
        open={open}
        danger
        title={`Suspend ${name}?`}
        description="They are signed out at once and can't sign in until someone restores them."
        confirmLabel={`Suspend ${name}`}
        busy={busy}
        onConfirm={() => void run(() => onSuspend(reason.trim()))}
        onCancel={() => setOpen(false)}
      >
        <TextArea
          label="Reason (optional)"
          hint="Only admins see it."
          value={reason}
          maxLength={200}
          onChange={(e) => setReason(e.target.value)}
        />
      </ConfirmDialog>
    </>
  )
}
