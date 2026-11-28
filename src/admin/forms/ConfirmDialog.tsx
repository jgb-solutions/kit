import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from '../ui/Button'

export type ConfirmDialogProps = {
  open: boolean
  /** The question ("Suspend Leo Martin?"). */
  title: ReactNode
  /** What will happen, in a sentence. */
  description?: ReactNode
  /** The button that does it, naming the action ("Suspend Leo Martin"), never just "OK". */
  confirmLabel: string
  cancelLabel?: string
  /** Destructive styling for the confirm button. */
  danger?: boolean
  /** While the action runs: the buttons wait. */
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
  /** Extra fields (a reason). */
  children?: ReactNode
}

/**
 * A modal question before a risky action, on the browser's own <dialog>: focus stays inside it,
 * Escape and the backdrop cancel, and focus returns to what opened it. It fades and scales in (off
 * with reduced motion).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className="ja-dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
      onClick={(event) => {
        // A click on the backdrop (the dialog element itself, outside its box) cancels.
        if (event.target === ref.current && !busy) onCancel()
      }}
    >
      <form
        method="dialog"
        className="ja-dialog-box"
        onSubmit={(event) => {
          event.preventDefault()
          if (!busy) onConfirm()
        }}
      >
        <h2 id={titleId} className="ja-tile-title">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="ja-dialog-text">
            {description}
          </p>
        )}
        {children}
        <div className="ja-dialog-actions">
          <Button variant="quiet" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} aria-disabled={busy || undefined}>
            {busy ? `${confirmLabel}…` : confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
