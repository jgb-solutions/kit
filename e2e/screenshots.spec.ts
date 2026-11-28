import { test } from '@playwright/test'
import { open } from './helpers'

/**
 * Review screenshots (desktop 1366 and phone 390, light and dark) into SCREENSHOTS_DIR (default
 * .screenshots/). `bun run screenshots`. Not part of the test run.
 */
const DIR = process.env.SCREENSHOTS_DIR ?? '.screenshots'
const SIZES = [
  ['desktop', { width: 1366, height: 900 }, false],
  ['phone', { width: 390, height: 844 }, true],
] as const

for (const theme of ['light', 'dark'] as const) {
  for (const [label, viewport, mobile] of SIZES) {
    test(`@screenshots ${label} ${theme}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2 })
      const page = await context.newPage()
      await open(page, theme, '#overview')
      if (mobile) {
        // The dock is fixed to the screen: a full-page capture would paint it mid-page, so phones get screens.
        await page.screenshot({ path: `${DIR}/overview-${label}-${theme}-1.png` })
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2 - 300))
        await page.screenshot({ path: `${DIR}/overview-${label}-${theme}-2.png` })
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await page.screenshot({ path: `${DIR}/overview-${label}-${theme}-3.png` })
      } else await page.screenshot({ path: `${DIR}/overview-${label}-${theme}.png`, fullPage: true })
      await open(page, theme, '?state=loading#overview')
      await page.screenshot({ path: `${DIR}/overview-loading-${label}-${theme}.png`, fullPage: !mobile })
      await open(page, theme, '?state=empty#users')
      await page.screenshot({ path: `${DIR}/users-empty-${label}-${theme}.png`, fullPage: !mobile })
      await open(page, theme, '#analytics')
      await page.screenshot({ path: `${DIR}/analytics-${label}-${theme}.png`, fullPage: !mobile })
      await page.getByRole('img', { name: /^Thu: This week 66/ }).focus()
      await page.getByRole('img', { name: /^Thu: This week 66/ }).scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${DIR}/analytics-value-${label}-${theme}.png` })
      await open(page, theme, '#settings')
      await page.getByLabel('Site name').fill('')
      await page.screenshot({ path: `${DIR}/settings-${label}-${theme}.png`, fullPage: !mobile })
      if (mobile) {
        // The page's end, scrolled clear of the dock.
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await page.screenshot({ path: `${DIR}/settings-end-${label}-${theme}.png` })
      }
      await open(page, theme, '#users')
      await page.getByRole('combobox', { name: 'Role for Ada Okafor' }).selectOption('Editor')
      await page.locator('.ja-toast').waitFor()
      await page.waitForTimeout(1100) // past the toast's slide-in and the row's highlight
      await page.screenshot({ path: `${DIR}/toast-${label}-${theme}.png` })
      await page.getByRole('button', { name: 'Suspend Priya Nair' }).click()
      await page.getByRole('dialog').getByLabel('Reason (optional)').fill('Spam links')
      await page.waitForTimeout(300) // past the dialog's fade-in
      await page.screenshot({ path: `${DIR}/dialog-${label}-${theme}.png` })
      if (!mobile) {
        await open(page, theme, '#overview')
        await page.getByRole('button', { name: 'Collapse the menu to icons' }).click()
        await page.screenshot({ path: `${DIR}/shell-rail-${label}-${theme}.png` })
      }
      await context.close()
    })
  }
}
