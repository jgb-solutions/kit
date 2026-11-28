import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { inkOn } from '../contrast'
import { ToastProvider } from '../forms/Toast'
import { ThemeProvider, useThemeState, type ThemeChoice } from '../theme'
import { Dock } from './Dock'
import type { NavItem, NavSection, RenderLink } from './nav'
import { Sidebar, type AppIdentity, type SidebarProps } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'

export type AdminShellProps = {
  app: AppIdentity
  /** The app's colour (hex): active navigation, primary buttons, meters, links. Text on it is white or ink, whichever reads better. */
  brand?: string | undefined
  nav: NavSection[]
  /** Which nav items the phone's dock shows, by key (at most 5). Default: the first 5. */
  dockItems?: string[] | undefined
  user?: SidebarProps['user']
  /** Renders a navigation link with the app's router (TanStack Router's Link, Next's Link…). Default: <a href>. */
  renderLink?: RenderLink | undefined
  /** Buttons in the phone's top bar, after the theme switch (notifications). */
  mobileActions?: ReactNode
  /** Extra things at the bottom of the sidebar, above the person. */
  sidebarFooter?: ReactNode
  /** The theme, when the app keeps it (controlled). */
  theme?: ThemeChoice | undefined
  /** The theme before the stored one is read: what server rendering shows. Default "system". */
  defaultTheme?: ThemeChoice | undefined
  onThemeChange?: ((choice: ThemeChoice) => void) | undefined
  children: ReactNode
}

/**
 * The admin's frame: the floating dark sidebar on desktop; on phones a top bar and the floating dock.
 * Holds the theme (light, dark, system) and the app's brand colour. Every other part of the kit goes
 * inside it, and its styles stay inside it (`.ja-root`).
 */
export function AdminShell({
  app,
  brand,
  nav,
  dockItems,
  user,
  renderLink,
  mobileActions,
  sidebarFooter,
  theme,
  defaultTheme,
  onThemeChange,
  children,
}: AdminShellProps) {
  const state = useThemeState({ choice: theme, defaultChoice: defaultTheme, onChoiceChange: onThemeChange })
  const style = useMemo(() => (brand ? ({ '--brand': brand, '--brand-ink': inkOn(brand) } as CSSProperties) : undefined), [brand])
  const all = nav.flatMap((section) => section.items)
  const dock: NavItem[] = dockItems
    ? dockItems.map((key) => all.find((item) => item.key === key)).filter((item): item is NavItem => item !== undefined)
    : all.slice(0, 5)

  return (
    <ThemeProvider value={state}>
      <div className="ja-root" data-theme={state.choice === 'system' ? undefined : state.choice} style={style}>
        <ToastProvider>
          <div className="ja-shell">
            <Sidebar app={app} sections={nav} user={user} renderLink={renderLink} footer={sidebarFooter} />
            <main className="ja-main" id="main">
              <div className="ja-mobile-top">
                <span className="ja-mark" aria-hidden="true">
                  {app.mark}
                </span>
                <span>{app.name}</span>
                <div className="ja-actions">
                  <ThemeToggle />
                  {mobileActions}
                </div>
              </div>
              {children}
            </main>
          </div>
          <Dock items={dock} renderLink={renderLink} />
        </ToastProvider>
      </div>
    </ThemeProvider>
  )
}
