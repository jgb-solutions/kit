import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primary (the brand colour, one per page area), quiet (a tile), or danger. */
  variant?: 'primary' | 'quiet' | 'danger'
  size?: 'normal' | 'small'
  icon?: ReactNode
}

/** A button that says what it does ("Invite people", "Suspend Leo Martin"). */
export function Button({ variant = 'primary', size = 'normal', icon, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={className ? `ja-button ${className}` : 'ja-button'}
      data-variant={variant === 'primary' ? undefined : variant}
      data-size={size === 'normal' ? undefined : size}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** The accessible name: what pressing it does ("Notifications", "Switch to dark mode"). */
  label: string
  icon: ReactNode
  /** A small red dot: something new to see. */
  dot?: boolean
  tone?: 'tile' | 'night'
}

/** A round button with only an icon; `label` names it for screen readers and as its tooltip. */
export function IconButton({ label, icon, dot = false, tone = 'tile', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={className ? `ja-icon-button ${className}` : 'ja-icon-button'}
      data-tone={tone === 'tile' ? undefined : tone}
      {...rest}
    >
      {icon}
      {dot && <span className="ja-dot" aria-hidden="true" />}
    </button>
  )
}
