import { expect, test } from '@playwright/test'
import { expectAccessible, expectFitsScreen, open } from './helpers'

for (const theme of ['light', 'dark'] as const) {
  for (const state of ['', '?state=loading', '?state=empty']) {
    test(`the overview's blocks are accessible and fit (${theme}${state ? `, ${state.slice(7)}` : ''})`, async ({ page }) => {
      await open(page, theme, `${state}#overview`)
      await expectAccessible(page)
      await expectFitsScreen(page)
    })
  }
}

test('the hero: the period switch changes the number and the chart, with a table for screen readers', async ({ page }) => {
  await open(page, 'light')
  const hero = page.locator('.ja-hero')
  await expect(hero.getByRole('img', { name: 'Visits per day this week' })).toBeVisible()
  await expect(hero.getByRole('table', { name: 'Visits per day this week' }).getByRole('row')).toHaveCount(7)
  await hero.getByRole('button', { name: 'Month' }).click()
  await expect(hero.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
  await expect(hero.locator('.ja-number')).toHaveText('157,220')
  await expect(hero.getByRole('img', { name: 'Visits per week this month' })).toBeVisible()
})

test('the users table: filters, search with its empty state, and pages', async ({ page }) => {
  await open(page, 'light', '#users')
  const table = page.getByRole('table', { name: 'Users' })
  const rows = table.locator('tbody tr')
  await expect(rows).toHaveCount(6)
  await page.getByRole('button', { name: 'Suspended' }).click()
  await expect(rows).toHaveCount(1)
  await expect(table.getByRole('button', { name: 'Restore Leo Martin' })).toBeVisible()
  await page.getByRole('button', { name: 'All' }).click()
  await page.getByRole('navigation', { name: 'User pages' }).getByRole('button', { name: 'Page 2' }).click()
  await expect(page.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page')
  await expect(rows).toHaveCount(2)
  await page.getByRole('searchbox', { name: 'Search by name or email' }).fill('zebra')
  await expect(page.getByText('No people match “zebra”.')).toBeVisible()
  await page.getByRole('button', { name: 'Clear the search' }).click()
  await expect(page.getByRole('table', { name: 'Users' })).toBeVisible()
})

test('the users table sorts from its headers: aria-sort, the arrow, and back the other way', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop: phones sort from a list')
  await open(page, 'light', '#users')
  const table = page.getByRole('table', { name: 'Users' })
  const person = table.getByRole('columnheader', { name: 'Person' })
  const firstName = table.locator('tbody tr').first().locator('b')
  await expect(person).not.toHaveAttribute('aria-sort', /./)
  await person.getByRole('button').click()
  await expect(person).toHaveAttribute('aria-sort', 'ascending')
  await expect(firstName).toHaveText('Ada Okafor')
  await person.getByRole('button').click()
  await expect(person).toHaveAttribute('aria-sort', 'descending')
  await expect(firstName).toHaveText('Tomás Ruiz')
  // From the keyboard too: another column, its first direction.
  await table.getByRole('columnheader', { name: 'Role' }).getByRole('button').focus()
  await page.keyboard.press('Enter')
  await expect(table.getByRole('columnheader', { name: 'Role' })).toHaveAttribute('aria-sort', 'ascending')
  await expect(person).not.toHaveAttribute('aria-sort', /./)
  await expect(firstName).toHaveText('Jonas Lind')
})

test('phone: the users table sorts from a "Sort by" list', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phones only')
  await open(page, 'light', '#users')
  await page.getByLabel('Sort by').selectOption({ label: 'Person, Z to A' })
  await expect(page.getByRole('table', { name: 'Users' }).locator('tbody tr').first().locator('b')).toHaveText('Tomás Ruiz')
  await expectFitsScreen(page)
})

test('the users table: rows per page, back to the first page', async ({ page }) => {
  await open(page, 'light', '#users')
  const rows = page.getByRole('table', { name: 'Users' }).locator('tbody tr')
  await page.getByRole('navigation', { name: 'User pages' }).getByRole('button', { name: 'Page 2' }).click()
  await expect(rows).toHaveCount(2)
  await page.getByLabel('Rows per page').selectOption('12')
  await expect(rows).toHaveCount(8)
  await expect(page.getByRole('navigation', { name: 'User pages' })).toHaveCount(0)
  await expectFitsScreen(page)
})

test('phone: tiles stack in two columns and table rows become cards', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phones only')
  await open(page, 'light')
  const hero = await page.locator('.ja-hero').boundingBox()
  const reports = await page.locator('.ja-tile[data-tone="sun"]').boundingBox()
  expect(hero!.width).toBeGreaterThan(330)
  expect(reports!.width).toBeLessThan(200)
  await expect(page.getByRole('table', { name: 'Users' }).locator('thead')).toBeHidden()
  const row = page.getByRole('table', { name: 'Users' }).locator('tbody tr').first()
  const status = await row.getByText('Active', { exact: true }).boundingBox()
  const person = await row.getByText('Priya Nair', { exact: true }).boundingBox()
  // Status sits on the person's line, to the right.
  expect(Math.abs(status!.y - person!.y)).toBeLessThan(24)
  expect(status!.x).toBeGreaterThan(person!.x)
})

for (const theme of ['light', 'dark'] as const) {
  test(`charts are accessible, each with a table of its values (${theme})`, async ({ page }) => {
    await open(page, theme, '#analytics')
    await expectAccessible(page)
    await expectFitsScreen(page)
    const bars = page.getByRole('table', { name: 'Sign-ups per day, this week and last' })
    await expect(bars.getByRole('columnheader')).toHaveText(['This week', 'Last week'])
    await expect(bars.getByRole('row', { name: /Thu/ })).toContainText('66')
    await expect(page.getByRole('img', { name: 'Reports opened this month, by reason' }).locator('rect')).toHaveCount(4)
  })
}

test('chart values show on hover and from the keyboard, one tab stop per chart', async ({ page, isMobile }) => {
  await open(page, 'light', '#analytics')
  const signups = page.locator('.ja-chart').filter({ has: page.getByRole('table', { name: 'Sign-ups per day, this week and last' }) })
  const tip = signups.locator('.ja-chart-tip')
  await expect(tip).toBeHidden()
  // Tab reaches the chart once, on its last group; the arrows move from there.
  const points = signups.getByRole('img', { name: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun):/ })
  await expect(points).toHaveCount(7)
  await expect(signups.locator('[tabindex="0"]')).toHaveCount(1)
  await signups.getByRole('img', { name: 'Sun: This week 30, Last week 27' }).focus()
  await expect(tip).toHaveText(/Sun\s*30\s*27/)
  await page.keyboard.press('Home')
  await expect(signups.getByRole('img', { name: 'Mon: This week 38, Last week 29' })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(tip).toHaveText(/Thu\s*66\s*50/)
  // The tooltip stays inside the tile.
  const tile = await signups.boundingBox()
  const box = await tip.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(tile!.x - 1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(tile!.x + tile!.width + 1)
  await expectAccessible(page)
  // The line chart too, by pointer on desktop.
  if (!isMobile) {
    const line = page.locator('.ja-chart').filter({ has: page.getByRole('table', { name: 'Pages published per week this month' }) })
    await line.getByRole('img', { name: 'W2: 72' }).hover()
    await expect(line.locator('.ja-chart-tip')).toHaveText(/W2\s*72/)
    await page.mouse.move(0, 0)
    await expect(line.locator('.ja-chart-tip')).toBeHidden()
  }
})
