import type { ReactNode } from 'react'

/** One place in the admin. `current` marks the page being shown. */
export type NavItem = {
  /** Stable and unique: the React key, and how `dockItems` picks items. */
  key: string
  label: string
  href: string
  icon: ReactNode
  /** A number to show next to it (people waiting, open reports). */
  count?: number | string | undefined
  current?: boolean | undefined
}

/** A labelled group in the sidebar ("Manage"). `end` groups sit at the bottom (Settings). */
export type NavSection = {
  label?: string | undefined
  items: NavItem[]
  placement?: 'start' | 'end' | undefined
}

/** What a link needs; apps with a router pass `renderLink` to render their own link component. */
export type LinkProps = {
  item: NavItem
  className: string
  'aria-current': 'page' | undefined
  title: string | undefined
  children: ReactNode
}

export type RenderLink = (props: LinkProps) => ReactNode

/** A plain link: the default when the app passes no `renderLink`. */
export const plainLink: RenderLink = ({ item, children, ...rest }) => (
  <a href={item.href} {...rest}>
    {children}
  </a>
)

/** "2481" → "2,481"; strings as given. */
export const formatCount = (count: number | string) => (typeof count === 'number' ? count.toLocaleString('en-US') : count)

/** A count for the icon rail's small badge: 99 at most ("99+"); strings as given. */
export const formatBadge = (count: number | string) => (typeof count === 'number' && count > 99 ? '99+' : formatCount(count))
