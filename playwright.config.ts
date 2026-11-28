import { defineConfig, devices } from '@playwright/test'

/**
 * The package's E2E tests run against the playground (playground/serve.ts): axe (WCAG 2.1 AA) in
 * light and dark, desktop and phone, no horizontal scrolling at 390 px, and each component's
 * behaviour. `bun run test:e2e`.
 */
const PORT = 4401
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } }, grepInvert: /@screenshots/ },
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, grepInvert: /@screenshots/ },
    { name: 'screenshots', use: { ...devices['Desktop Chrome'] }, grep: /@screenshots/ },
  ],
  webServer: {
    command: 'bun playground/serve.ts',
    url: `http://127.0.0.1:${PORT}/`,
    env: { PORT: String(PORT), NODE_ENV: 'production' },
    reuseExistingServer: !process.env.CI,
  },
})
