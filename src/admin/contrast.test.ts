import { describe, expect, test } from 'bun:test'
import { contrastRatio, inkOn, parseHex } from './contrast'

/** The kit's own pairs: every one must meet WCAG AA (4.5:1 for text). */
const LIGHT = { canvas: '#eceaf6', tile: '#ffffff', sunk: '#f6f5fb', night: '#1f1b33', ink: '#1c1930', muted: '#6b6785' }
const DARK = { canvas: '#121022', tile: '#1c1930', sunk: '#24203a', night: '#0d0b18', ink: '#f1effa', muted: '#a39fbf' }

describe('contrast', () => {
  test('parses #rgb and #rrggbb, and refuses anything else', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255])
    expect(parseHex('6b4ce6')).toEqual([107, 76, 230])
    expect(parseHex('red')).toBeNull()
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5)
  })

  test("the kit's text colours meet AA on every surface, light and dark", () => {
    for (const [name, t] of Object.entries({ LIGHT, DARK })) {
      for (const surface of [t.canvas, t.tile, t.sunk]) {
        expect(contrastRatio(t.ink, surface), `${name} ink on ${surface}`).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(t.muted, surface), `${name} muted on ${surface}`).toBeGreaterThanOrEqual(4.5)
      }
    }
    // The sidebar, dock and hero: muted labels and white text on --night.
    for (const night of [LIGHT.night, DARK.night]) {
      expect(contrastRatio('#a9a3cc', night)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio('#d6d2ee', night)).toBeGreaterThanOrEqual(4.5)
    }
    // Status colours on tiles.
    for (const [good, warn, bad, tile] of [
      ['#158150', '#946200', '#b42318', LIGHT.sunk],
      ['#4cc38a', '#f0b429', '#ff7a6b', DARK.sunk],
    ] as const) {
      for (const status of [good, warn, bad]) expect(contrastRatio(status, tile), `${status} on ${tile}`).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrastRatio('#4a3500', '#ffc84a')).toBeGreaterThanOrEqual(4.5) // --sun-ink on --sun
    expect(contrastRatio('#ffffff', '#b42318')).toBeGreaterThanOrEqual(4.5) // danger button, light
    expect(contrastRatio('#1c1930', '#ff7a6b')).toBeGreaterThanOrEqual(4.5) // danger button, dark
  })

  test('picks white on a dark brand and ink on a light one', () => {
    expect(inkOn('#6b4ce6')).toBe('#ffffff')
    expect(inkOn('#ffc84a')).toBe('#1c1930')
    expect(inkOn('not a colour')).toBe('#ffffff')
  })
})
