import { useRef, type KeyboardEvent } from 'react'
import { icons } from '../icons'
import { useAdminTheme, type ThemeChoice } from '../theme'
import { IconButton } from '../ui/Button'

const OPTIONS = [
  { choice: 'light', label: 'Light', short: 'Light', Icon: icons.sun },
  { choice: 'dark', label: 'Dark', short: 'Dark', Icon: icons.moon },
  { choice: 'system', label: 'Match system', short: 'System', Icon: icons.screen },
] as const satisfies readonly { choice: ThemeChoice; label: string; short: string; Icon: (typeof icons)['sun'] }[]

/** Where an arrow, Home or End key moves in the group (the radio pattern), or null for another key. */
export function nextIndex(key: string, current: number, count: number): number | null {
  if (key === 'ArrowRight' || key === 'ArrowDown') return (current + 1) % count
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (current - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}

/**
 * The theme switch: light, dark, or the system's (the default). A radio group of three; in the
 * dark sidebar it shows the names too, and in a collapsed sidebar it's one button that goes to the
 * next choice. The choice is remembered (AdminShell keeps it).
 */
export function ThemeToggle({ tone = 'tile' }: { tone?: 'tile' | 'night' }) {
  const { choice, setChoice } = useAdminTheme()
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const index = OPTIONS.findIndex((option) => option.choice === choice)
  const current = OPTIONS[index] ?? OPTIONS[2]
  const next = OPTIONS[(index + 1) % OPTIONS.length] ?? OPTIONS[0]

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const to = nextIndex(event.key, index, OPTIONS.length)
    const option = to === null ? undefined : OPTIONS[to]
    if (to === null || !option) return
    event.preventDefault()
    setChoice(option.choice)
    buttons.current[to]?.focus()
  }

  return (
    <div className="ja-theme" data-tone={tone === 'tile' ? undefined : tone}>
      <div role="radiogroup" aria-label="Theme" className="ja-theme-options" onKeyDown={onKeyDown}>
        {OPTIONS.map((option, i) => (
          <button
            key={option.choice}
            ref={(el) => {
              buttons.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={option.choice === choice}
            aria-label={option.label}
            title={option.label}
            tabIndex={option.choice === choice ? 0 : -1}
            onClick={() => setChoice(option.choice)}
          >
            <option.Icon />
            <span aria-hidden="true">{option.short}</span>
          </button>
        ))}
      </div>
      <IconButton
        className="ja-theme-cycle"
        tone={tone}
        icon={<current.Icon />}
        label={`Theme: ${current.label}. Switch to ${next.label}`}
        onClick={() => setChoice(next.choice)}
      />
    </div>
  )
}
