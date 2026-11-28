import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/** Opens the playground in a theme, and waits for the fonts (screenshots and contrast need them). */
export async function open(page: Page, theme: 'light' | 'dark', hash = '') {
  // Once per test: a reload keeps whatever the test switched to.
  await page.addInitScript((choice) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('jgb-admin-theme', choice)
  }, theme)
  // A fresh load each time: going from /#a to /#b alone only changes the hash.
  await page.goto('about:blank')
  await page.goto(`/${hash}`)
  await expect(page.locator('.ja-root')).toHaveAttribute('data-theme', theme)
  await page.evaluate(() => document.fonts.ready)
}

/** No serious or critical WCAG 2.1 AA problem, colour contrast included. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
}

/** Nothing wider than the screen: no horizontal scrolling. */
export async function expectFitsScreen(page: Page) {
  const { page: width, screen } = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, screen: window.innerWidth }))
  expect(width).toBeLessThanOrEqual(screen)
}
