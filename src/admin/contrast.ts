/**
 * WCAG 2 contrast, for the app's brand colour: AdminShell checks it against the text drawn on it
 * (buttons, the active nav item) and picks white or ink, whichever reads better.
 */

/** `#rgb` or `#rrggbb` as [r, g, b] in 0–255, or null. */
export function parseHex(color: string): [number, number, number] | null {
  const hex = color.trim().replace(/^#/, '')
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  return [0, 2, 4].map((at) => Number.parseInt(full.slice(at, at + 2), 16)) as [number, number, number]
}

/** Relative luminance (WCAG 2.x). */
export function luminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** The contrast ratio of two hex colours (1 to 21), or null if either isn't a hex colour. */
export function contrastRatio(a: string, b: string): number | null {
  const ca = parseHex(a)
  const cb = parseHex(b)
  if (!ca || !cb) return null
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** White or the kit's ink, whichever reads better on `brand` (white when `brand` isn't a hex colour). */
export function inkOn(brand: string, light = '#ffffff', dark = '#1c1930'): string {
  const onLight = contrastRatio(brand, light)
  const onDark = contrastRatio(brand, dark)
  if (onLight === null || onDark === null) return light
  return onLight >= 4.5 || onLight >= onDark ? light : dark
}
