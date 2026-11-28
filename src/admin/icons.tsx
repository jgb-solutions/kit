import type { SVGProps } from 'react'

/**
 * A small set of line icons (24×24, currentColor, 1.9 stroke) for the shell and for apps' navigation.
 * Decorative by default (aria-hidden): the link or button around one names it. Apps may pass any
 * other icon as a ReactNode instead.
 */
type IconProps = SVGProps<SVGSVGElement>

function icon(paths: React.ReactNode, extra: IconProps = {}) {
  return function Icon(props: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...extra}
        {...props}
      >
        {paths}
      </svg>
    )
  }
}

export const icons = {
  home: icon(
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.5h13V10" />
    </>,
  ),
  users: icon(
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.4 3.5 5.2" />
    </>,
  ),
  box: icon(
    <>
      <path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9z" />
      <path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 12v9" />
    </>,
  ),
  chart: icon(<path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />),
  flag: icon(<path d="M5 21V4M5 4h11l-2 4 2 4H5" />),
  gear: icon(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>,
  ),
  search: icon(
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>,
  ),
  bell: icon(
    <>
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>,
  ),
  screen: icon(
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8.5 20h7M12 16v4" />
    </>,
  ),
  moon: icon(<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />),
  sun: icon(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>,
  ),
  sidebar: icon(
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <path d="M9.5 4.5v15" />
    </>,
  ),
  doc: icon(
    <>
      <path d="M6 3.5h8l4 4v13H6z" />
      <path d="M14 3.5v4h4" />
    </>,
  ),
  plus: icon(<path d="M12 5v14M5 12h14" />, { strokeWidth: 2 }),
  check: icon(<path d="m5 12.5 4.5 4.5L19 7.5" />, { strokeWidth: 2.2 }),
  block: icon(
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m6.5 6.5 11 11" />
    </>,
    { strokeWidth: 2 },
  ),
  chevronDown: icon(<path d="m7 10 5 5 5-5" />, { strokeWidth: 2 }),
  chevronRight: icon(<path d="m10 7 5 5-5 5" />, { strokeWidth: 2 }),
  chevronLeft: icon(<path d="m14 7-5 5 5 5" />, { strokeWidth: 2 }),
  close: icon(<path d="M6 6l12 12M18 6 6 18" />, { strokeWidth: 2 }),
} as const

export type IconName = keyof typeof icons
