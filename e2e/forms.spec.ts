import { expect, test } from '@playwright/test'
import { expectAccessible, expectFitsScreen, open } from './helpers'

for (const theme of ['light', 'dark'] as const) {
  test(`settings: fields, switches and an error are accessible (${theme})`, async ({ page }) => {
    await open(page, theme, '#settings')
    await page.getByLabel('Site name').fill('')
    await expect(page.getByText('Enter the site’s name.')).toBeVisible()
    await expect(page.getByLabel('Site name')).toHaveAttribute('aria-invalid', 'true')
    await expectAccessible(page)
    await expectFitsScreen(page)
  })

  test(`the confirm dialog is accessible (${theme})`, async ({ page }) => {
    await open(page, theme, '#users')
    await page.getByRole('button', { name: 'Suspend Priya Nair' }).click()
    await expect(page.getByRole('dialog', { name: 'Suspend Priya Nair?' })).toBeVisible()
    // Past the fade-in: axe measures colours as they end up.
    await page.waitForTimeout(300)
    await expectAccessible(page)
  })
}

test('fields: the hint and the error describe the input', async ({ page }) => {
  await open(page, 'light', '#settings')
  await expect(page.getByLabel('Contact email')).toHaveAccessibleDescription('Shown on the contact page.')
  await page.getByLabel('Site name').fill('')
  await expect(page.getByLabel('Site name')).toHaveAccessibleDescription('Enter the site’s name.')
})

test('a switch applies at once and says its state', async ({ page }) => {
  await open(page, 'light', '#settings')
  const signUps = page.getByRole('switch', { name: 'Open sign-up' })
  await expect(signUps).toHaveAttribute('aria-checked', 'true')
  await signUps.click()
  await expect(signUps).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('switch', { name: 'Passkeys' })).toBeDisabled()
})

test('changing a role: plain roles apply with a toast; Admin asks first, and Escape keeps the old role', async ({ page }) => {
  await open(page, 'light', '#users')
  const role = page.getByRole('combobox', { name: 'Role for Ada Okafor' })
  await role.selectOption('Editor')
  await expect(page.getByRole('status').filter({ hasText: 'Ada Okafor is now an Editor.' })).toBeVisible()
  await expect(role).toHaveValue('Editor')

  await role.selectOption('Admin')
  const dialog = page.getByRole('dialog', { name: 'Make Ada Okafor an Admin?' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAccessibleDescription('Admins can change everyone’s role and suspend people.')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(role).toHaveValue('Editor')

  await role.selectOption('Admin')
  await dialog.getByRole('button', { name: 'Make Ada Okafor an Admin' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Ada Okafor is now an Admin.' })).toBeVisible()
  await expect(role).toHaveValue('Admin')
  // The row lights up for a second after the change.
  await expect(page.locator('tbody tr[data-flash="true"]')).toHaveCount(1)
})

test('suspending asks with a reason, names the person on the button, and restoring brings them back', async ({ page }) => {
  await open(page, 'light', '#users')
  await page.getByRole('button', { name: 'Suspend Jonas Lind' }).click()
  const dialog = page.getByRole('dialog', { name: 'Suspend Jonas Lind?' })
  // Focus starts inside the dialog and stays there.
  await expect(dialog.getByLabel('Reason (optional)')).toBeFocused()
  await dialog.getByLabel('Reason (optional)').fill('Spam links')
  await dialog.getByRole('button', { name: 'Suspend Jonas Lind' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'Suspended Jonas Lind.' })).toBeVisible()
  const row = page.locator('tbody tr').filter({ hasText: 'Jonas Lind' })
  await expect(row.getByText('Suspended')).toBeVisible()
  await row.getByRole('button', { name: 'Restore Jonas Lind' }).click()
  await expect(row.getByText('Active')).toBeVisible()
})

test('an error toast stays until dismissed; done toasts leave on their own', async ({ page, isMobile }) => {
  await open(page, 'light', '#settings')
  await page.getByRole('button', { name: 'Show an error toast' }).click()
  const toast = page.locator('.ja-toast').filter({ hasText: 'Couldn’t reach the server.' })
  await expect(toast).toBeVisible()
  if (isMobile) {
    // Above the dock, never under it.
    const dock = await page.locator('.ja-dock').boundingBox()
    const box = await toast.boundingBox()
    expect(box!.y + box!.height).toBeLessThanOrEqual(dock!.y)
  }
  await toast.getByRole('button', { name: 'Dismiss' }).click()
  await expect(toast).toBeHidden()
  await page.getByRole('button', { name: 'Save settings' }).click()
  const done = page.locator('.ja-toast').filter({ hasText: 'Settings saved.' })
  await expect(done).toBeVisible()
  await expect(done).toBeHidden({ timeout: 6000 })
})
