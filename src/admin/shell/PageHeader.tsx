import type { InputHTMLAttributes, ReactNode } from 'react'
import { icons } from '../icons'

export type PageHeaderProps = {
  /** The page's one h1. */
  title: ReactNode
  /** One line of context under it. */
  description?: ReactNode
  /** Desktop-only tools: search, theme, notifications. On phones they live in the top bar or the page. */
  tools?: ReactNode
  /** The page's actions, shown on every screen size; one primary at most. */
  actions?: ReactNode
}

/** The top of a page: its title and context, then search, tools and the main action. */
export function PageHeader({ title, description, tools, actions }: PageHeaderProps) {
  return (
    <header className="ja-page-header">
      <div>
        <h1 className="ja-page-title">{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {tools && <div className="ja-actions ja-desktop-only">{tools}</div>}
      {actions && <div className="ja-actions">{actions}</div>}
    </header>
  )
}

export type TopSearchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** The accessible name, also the placeholder unless one is given ("Search anything"). */
  label: string
}

/** The page's search field: a pill with the search icon. The app handles what it searches. */
export function TopSearch({ label, placeholder, className, ...input }: TopSearchProps) {
  return (
    <label className={className ? `ja-topsearch ${className}` : 'ja-topsearch'}>
      <icons.search />
      <span className="ja-sr">{label}</span>
      <input type="search" placeholder={placeholder ?? label} {...input} />
    </label>
  )
}
