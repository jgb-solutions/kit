import { Fragment } from 'react'
import { plainLink, type NavItem, type RenderLink } from './nav'

export type DockProps = {
  /** Up to 5 items (more are not shown): icon over label, the current one filled with the brand colour. */
  items: NavItem[]
  renderLink?: RenderLink | undefined
}

/** The phone's navigation: a floating dark dock at the bottom (760 px and below). */
export function Dock({ items, renderLink = plainLink }: DockProps) {
  return (
    <nav className="ja-dock" aria-label="Admin">
      {items.slice(0, 5).map((item) => (
        // The app's renderLink returns an element without a key, so the key goes on a wrapper.
        <Fragment key={item.key}>
          {renderLink({
            item,
            className: 'ja-docklink',
            'aria-current': item.current ? 'page' : undefined,
            title: undefined,
            children: (
              <>
                {item.icon}
                <span>{item.label}</span>
              </>
            ),
          })}
        </Fragment>
      ))}
    </nav>
  )
}
