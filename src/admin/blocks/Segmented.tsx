export type SegmentedOption<V extends string> = { value: V; label: string }

/**
 * A few mutually exclusive choices in a pill (Day / Week / Month). Buttons with aria-pressed, in a
 * named group: each press applies at once.
 */
export function SegmentedControl<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** What the choice is about ("Period"). */
  label: string
  options: readonly SegmentedOption<V>[]
  value: V
  onChange: (value: V) => void
}) {
  return (
    <div className="ja-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}
