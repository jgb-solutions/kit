import { expect, test } from '@playwright/test'
import { expectAccessible, expectFitsScreen, open } from './helpers'

for (const theme of ['light', 'dark'] as const) {
  test(`the shell is accessible and fits the screen (${theme})`, async ({ page }) => {
    await open(page, theme)
    await expectAccessible(page)
    await expectFitsScreen(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("Hi Maya, it's a good week.")
  })
}

test('the current page is marked, and links switch it', async ({ page, isMobile }) => {
  await open(page, 'light')
  const nav = page.getByRole('navigation', { name: 'Admin' })
  await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
  await nav.getByRole('link', { name: /^Users/ }).click()
  await expect(nav.getByRole('link', { name: /^Users/ })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current', 'page')
  // The sidebar reads counts with the label; the dock shows no counts.
  if (!isMobile) await expect(nav.getByRole('link', { name: /^Users\W+2,481$/ })).toBeVisible()
})

test('desktop: the sidebar collapses to an icon rail, keeps names, and remembers it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the sidebar is desktop only')
  await open(page, 'light')
  const sidebar = page.getByRole('complementary', { name: 'Tidepool admin' })
  const collapse = sidebar.getByRole('button', { name: 'Collapse the menu to icons' })
  await expect(collapse).toHaveAttribute('aria-expanded', 'true')
  await collapse.click()
  await expect(sidebar).toHaveAttribute('data-collapsed', 'true')
  // Labels are hidden but stay the links' names (and their tooltips).
  await expect(sidebar.getByRole('link', { name: 'Overview' })).toHaveAttribute('title', 'Overview')
  // Big counts shrink to 99+ on the rail; the link still names the full number.
  await expect(sidebar.getByRole('link', { name: /^Users\W+2,481$/ })).toHaveAttribute('title', 'Users, 2,481')
  await expect(sidebar.getByRole('link', { name: /^Users/ }).locator('.ja-count')).toContainText('99+')
  await expectAccessible(page)
  await page.reload()
  await expect(sidebar).toHaveAttribute('data-collapsed', 'true')
  await sidebar.getByRole('button', { name: 'Show the menu labels' }).click()
  await expect(sidebar).not.toHaveAttribute('data-collapsed', 'true')
})

test('phone: the dock and the top bar replace the sidebar', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phones only')
  await open(page, 'light')
  await expect(page.getByRole('complementary', { name: 'Tidepool admin' })).toBeHidden()
  const dock = page.locator('.ja-dock')
  await expect(dock).toBeVisible()
  await expect(dock.getByRole('link')).toHaveText(['Overview', 'Users', 'Reports', 'Settings'])
  // The dock floats above the page; the page's end can still be scrolled clear of it.
  const box = await dock.boundingBox()
  expect(box?.y ?? 0).toBeGreaterThan(700)
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible()
})

test('phone: the end of a long page and every focused control scroll clear of the dock', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phones only')
  await open(page, 'light')
  const dockTop = async () => (await page.locator('.ja-dock').boundingBox())?.y ?? 0
  const controls = page.locator('.ja-main').locator('a, button:not(:disabled), input, select, textarea, [tabindex]:not([tabindex="-1"])')
  const last = controls.last()
  // Scrolled to the very end, the page's last control sits above the dock.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const end = await last.boundingBox()
  expect((end?.y ?? 0) + (end?.height ?? 0)).toBeLessThanOrEqual(await dockTop())
  // A control just below the screen, reached from the keyboard, scrolls into view above the dock, not under it.
  await page.evaluate(() => window.scrollTo(0, 0))
  const below = await controls.evaluateAll((els) => els.findIndex((el) => el.getBoundingClientRect().top > window.innerHeight + 40))
  expect(below).toBeGreaterThanOrEqual(0)
  const control = controls.nth(below)
  await control.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight + 1))
  await control.focus()
  const focused = await control.boundingBox()
  expect((focused?.y ?? 0) + (focused?.height ?? 0)).toBeLessThanOrEqual(await dockTop())
})

test('the theme switch offers light, dark and the system, and is remembered', async ({ page }) => {
  await open(page, 'light')
  const root = page.locator('.ja-root')
  const group = page.getByRole('radiogroup', { name: 'Theme' }).first()
  await group.getByRole('radio', { name: 'Dark' }).click()
  await expect(root).toHaveAttribute('data-theme', 'dark')
  expect(await root.evaluate((el) => getComputedStyle(el).getPropertyValue('--canvas').trim())).toBe('#121022')
  await page.reload()
  await expect(root).toHaveAttribute('data-theme', 'dark')
  await expect(group.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
  // The keyboard: an arrow picks the next choice, the system's (no data-theme: the CSS follows it).
  await group.getByRole('radio', { name: 'Dark' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(group.getByRole('radio', { name: 'Match system' })).toBeFocused()
  await expect(root).not.toHaveAttribute('data-theme', /./)
  await page.keyboard.press('Home')
  await expect(root).toHaveAttribute('data-theme', 'light')
})

test('in a collapsed sidebar the theme switch is one button that goes to the next choice', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await open(page, 'light')
  await page.getByRole('button', { name: /collapse/i }).click()
  const sidebar = page.locator('.ja-sidebar')
  await expect(sidebar.getByRole('radiogroup', { name: 'Theme' })).toBeHidden()
  await sidebar.getByRole('button', { name: 'Theme: Light. Switch to Dark' }).click()
  await expect(page.locator('.ja-root')).toHaveAttribute('data-theme', 'dark')
})

test("the brand's text colour follows the brand: white on a dark brand", async ({ page }) => {
  await open(page, 'light')
  const ink = await page.locator('.ja-root').evaluate((el) => getComputedStyle(el).getPropertyValue('--brand-ink').trim())
  expect(ink).toBe('#ffffff')
})
