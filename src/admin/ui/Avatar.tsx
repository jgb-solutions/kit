import type { CSSProperties } from 'react'

/** Soft background and dark text pairs (each AA), picked from the name so a person keeps their colour. */
const TONES: readonly [string, string][] = [
  ['#ffd9c9', '#8a2d12'],
  ['#d9ecff', '#1d4f91'],
  ['#e6f6ec', '#17603f'],
  ['#f1e8ff', '#5b2a9e'],
  ['#fff1c7', '#6b4a00'],
  ['#ffe0ee', '#8c1d4f'],
]

/** Up to two initials: "Priya Nair" → "PN", "maya" → "M". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? [words[0]!, words[words.length - 1]!] : words
  return letters.map((word) => [...word][0]!.toUpperCase()).join('')
}

/** The same name always gets the same colour pair. */
export function toneOf(name: string): [string, string] {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  return TONES[hash % TONES.length]!
}

export type AvatarProps = {
  name: string
  /** A picture; initials when absent or when it fails to load is up to the app (pass none). */
  src?: string | null | undefined
  size?: number
  /** "round" (people) or "soft" (a rounded square, as in tables). */
  shape?: 'round' | 'soft'
}

/** A person's picture or initials. Decorative: the name is always written next to it. */
export function Avatar({ name, src, size = 38, shape = 'round' }: AvatarProps) {
  const [background, color] = toneOf(name)
  const style = {
    '--size': `${size}px`,
    '--avatar-radius': shape === 'round' ? '50%' : `${Math.round(size * 0.37)}px`,
    background,
    color,
  } as CSSProperties
  return (
    <span className="ja-avatar" style={style} aria-hidden="true">
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  )
}
