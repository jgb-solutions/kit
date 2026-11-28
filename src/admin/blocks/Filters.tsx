export type FilterOption<V extends string> = { value: V; label: string; count?: number | undefined }

/** Filter tabs above a table (All / Admins / Suspended): pressed buttons in a named group. */
export function FilterTabs<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly FilterOption<V>[]
  value: V
  onChange: (value: V) => void
}) {
  return (
    <div className="ja-filters" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
          {option.count !== undefined && <span> {option.count.toLocaleString('en-US')}</span>}
        </button>
      ))}
    </div>
  )
}
