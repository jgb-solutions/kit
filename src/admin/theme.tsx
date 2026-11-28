import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

type ThemeState = {
  /** What the person chose: light, dark, or follow the system. */
  choice: ThemeChoice
  /** What is shown now. */
  theme: Theme
  setChoice: (choice: ThemeChoice) => void
}

const ThemeContext = createContext<ThemeState | null>(null)

/** Reads and writes browser storage, ignoring a blocked or private-mode store. */
export const storage = {
  get(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      globalThis.localStorage?.setItem(key, value)
    } catch {
      // Private mode or blocked storage: the choice just isn't remembered.
    }
  },
}

const isChoice = (value: unknown): value is ThemeChoice => value === 'light' || value === 'dark' || value === 'system'

function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * The theme for AdminShell: light, dark or the system's. Controlled when `choice` is given (the app
 * keeps it, e.g. in a cookie so the server renders it); otherwise kept in this browser under
 * `storageKey`. Server rendering uses `defaultChoice` ("system": the CSS follows the system with no
 * script), and the stored choice applies once the page runs.
 */
export function useThemeState(options: {
  choice?: ThemeChoice | undefined
  defaultChoice?: ThemeChoice | undefined
  onChoiceChange?: ((choice: ThemeChoice) => void) | undefined
  storageKey?: string | undefined
}): ThemeState {
  const { choice: controlled, defaultChoice = 'system', onChoiceChange, storageKey = 'jgb-admin-theme' } = options
  const [stored, setStored] = useState<ThemeChoice>(defaultChoice)
  const [system, setSystem] = useState<Theme>('light')

  useEffect(() => {
    const saved = storage.get(storageKey)
    if (controlled === undefined && isChoice(saved)) setStored(saved)
    setSystem(systemTheme())
    if (typeof matchMedia !== 'function') return
    const query = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystem(query.matches ? 'dark' : 'light')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [controlled, storageKey])

  const choice = controlled ?? stored
  const setChoice = useCallback(
    (next: ThemeChoice) => {
      if (controlled === undefined) {
        setStored(next)
        storage.set(storageKey, next)
      }
      onChoiceChange?.(next)
    },
    [controlled, onChoiceChange, storageKey],
  )
  return useMemo(() => ({ choice, theme: choice === 'system' ? system : choice, setChoice }), [choice, system, setChoice])
}

export const ThemeProvider = ThemeContext.Provider

/** The admin's theme, inside AdminShell. */
export function useAdminTheme(): ThemeState {
  const state = useContext(ThemeContext)
  if (!state) throw new Error('useAdminTheme must be used inside <AdminShell>.')
  return state
}
