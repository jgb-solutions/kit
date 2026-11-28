import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { icons } from '../icons'

/** The ids a control needs to be tied to its label, hint and error. */
export type FieldIds = { id: string; 'aria-describedby': string | undefined; 'aria-invalid': true | undefined }

export type FieldProps = {
  label: ReactNode
  /** Help under the label: what to enter. */
  hint?: ReactNode
  /** What's wrong and how to fix it ("Use at least 12 characters."). Shown in place of nothing, never as colour alone. */
  error?: ReactNode
  /** Any control, given the ids that tie it to the label, hint and error. */
  children: (ids: FieldIds) => ReactNode
}

/** A label, the control, a hint and an error, tied together for screen readers. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined
  return (
    <div className="ja-field">
      <label className="ja-field-label" htmlFor={id}>
        {label}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && (
        <p className="ja-field-hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        // role="alert": an error that appears after a submit is read out, not only on focus.
        <p className="ja-field-error" id={errorId} role="alert">
          <span className="ja-error-mark" aria-hidden="true">
            !
          </span>
          {error}
        </p>
      )}
    </div>
  )
}

type Labelled = { label: ReactNode; hint?: ReactNode; error?: ReactNode }

/** A text input with its label (any `type`: text, email, number, password…). */
export function TextInput({ label, hint, error, className, ...input }: Labelled & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(ids) => <input className={className ? `ja-input ${className}` : 'ja-input'} {...ids} {...input} />}
    </Field>
  )
}

export function TextArea({ label, hint, error, className, ...input }: Labelled & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(ids) => <textarea className={className ? `ja-input ${className}` : 'ja-input'} rows={3} {...ids} {...input} />}
    </Field>
  )
}

export type SelectOption = { value: string; label: string }

/** A native select (the phone's own picker), styled. */
export function Select({
  label,
  hint,
  error,
  options,
  className,
  ...select
}: Labelled & SelectHTMLAttributes<HTMLSelectElement> & { options: readonly SelectOption[] }) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(ids) => (
        <span className="ja-select-wrap">
          <select className={className ? `ja-select ${className}` : 'ja-select'} {...ids} {...select}>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <icons.chevronDown />
        </span>
      )}
    </Field>
  )
}

/** A checkbox with its label to the right, and an optional hint under it. */
export function Checkbox({
  label,
  hint,
  className,
  ...input
}: { label: ReactNode; hint?: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const id = useId()
  return (
    <div className={className ? `ja-check ${className}` : 'ja-check'}>
      <input type="checkbox" id={id} aria-describedby={hint ? `${id}-hint` : undefined} {...input} />
      <label htmlFor={id}>
        {label}
        {hint && (
          <small id={`${id}-hint`} className="ja-field-hint">
            {hint}
          </small>
        )}
      </label>
    </div>
  )
}

/** An on/off setting that applies at once (role="switch"); its label says what it turns on. */
export function Switch({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: ReactNode
  hint?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="ja-switch-row">
      <span>
        <span id={`${id}-label`}>{label}</span>
        {hint && (
          <small id={`${id}-hint`} className="ja-field-hint">
            {hint}
          </small>
        )}
      </span>
      <button
        type="button"
        role="switch"
        className="ja-switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span aria-hidden="true" />
      </button>
    </div>
  )
}
