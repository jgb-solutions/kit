import { useEffect, useId, useState, type ReactNode } from 'react'
import { icons } from '../icons'
import { storage } from '../theme'
import { IconButton } from '../ui/Button'
import { Avatar } from '../ui/Avatar'
import { formatBadge, formatCount, plainLink, type NavSection, type RenderLink } from './nav'

/** The app's name and mark (a letter, or its logo), shown in the sidebar and the phone's top bar. */
export type AppIdentity = { name: string; mark: ReactNode }

export type SidebarProps = {
  app: AppIdentity
  sections: NavSection[]
  /** The signed-in person, at the bottom. */
  user?: { name: string; role?: string | undefined; image?: string | null | undefined } | undefined
  renderLink?: RenderLink | undefined
  /** Where the collapsed state is remembered in this browser. */
  storageKey?: string | undefined
  /** Extra things above the person (a sign-out link). */
  footer?: ReactNode
}

/**
 * The desktop navigation: Bento's floating dark panel with Daylight's labelled sections, collapsible
 * to an icon rail (remembered in this browser). Hidden at 760 px and below, where the Dock takes over.
 */
export function Sidebar({ app, sections, user, renderLink = plainLink, storageKey = 'jgb-admin-sidebar', footer }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const labelId = useId()
  useEffect(() => {
    setCollapsed(storage.get(storageKey) === 'collapsed')
  }, [storageKey])
  const toggle = () => {
    setCollapsed((was) => {
      storage.set(storageKey, was ? 'open' : 'collapsed')
      return !was
    })
  }

  const group = (section: NavSection, index: number) => {
    const id = `${labelId}-${index}`
    return (
      <div key={section.label ?? index}>
        {section.label && !collapsed && (
          <div className="ja-navlabel" id={id}>
            {section.label}
          </div>
        )}
        <ul className="ja-nav" aria-labelledby={section.label && !collapsed ? id : undefined}>
          {section.items.map((item) => (
            <li key={item.key}>
              {renderLink({
                item,
                className: 'ja-navlink',
                'aria-current': item.current ? 'page' : undefined,
                // In the rail the label is hidden: it becomes the tooltip, and stays the accessible name.
                title: collapsed ? (item.count !== undefined ? `${item.label}, ${formatCount(item.count)}` : item.label) : undefined,
                children: (
                  <>
                    {item.icon}
                    <span className={collapsed ? 'ja-sr' : undefined}>{item.label}</span>
                    {item.count !== undefined && (
                      <span className="ja-count">
                        {collapsed ? (
                          // The rail's badge is small: big numbers show as 99+; screen readers get the full one.
                          <>
                            <span className="ja-sr">, {formatCount(item.count)}</span>
                            <span aria-hidden="true">{formatBadge(item.count)}</span>
                          </>
                        ) : (
                          <>
                            <span className="ja-sr">, </span>
                            {formatCount(item.count)}
                          </>
                        )}
                      </span>
                    )}
                  </>
                ),
              })}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const start = sections.filter((section) => section.placement !== 'end')
  const end = sections.filter((section) => section.placement === 'end')
  return (
    <aside className="ja-sidebar" data-collapsed={collapsed ? 'true' : undefined} aria-label={`${app.name} admin`}>
      <div className="ja-brandrow">
        <span className="ja-mark" aria-hidden="true">
          {app.mark}
        </span>
        <span className={collapsed ? 'ja-sr' : 'ja-brand-name'}>{app.name}</span>
        <IconButton
          className="ja-collapse"
          tone="night"
          icon={<icons.sidebar />}
          label={collapsed ? 'Show the menu labels' : 'Collapse the menu to icons'}
          aria-expanded={!collapsed}
          onClick={toggle}
        />
      </div>
      <nav aria-label="Admin" className="ja-sidebar-nav">
        {start.map(group)}
        {end.length > 0 && <div className="ja-nav-end">{end.map((section, i) => group(section, start.length + i))}</div>}
      </nav>
      {(user || footer) && (
        <div className="ja-sidebar-bottom">
          {footer}
          {user && (
            <div className="ja-me" title={collapsed ? `${user.name}${user.role ? `, ${user.role}` : ''}` : undefined}>
              <Avatar name={user.name} src={user.image} size={36} />
              <span className={collapsed ? 'ja-sr' : undefined}>
                <b>{user.name}</b>
                {user.role && <small>{user.role}</small>}
              </span>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
