/**
 * The playground: every component with sample data, for development, screenshots and the E2E tests.
 * `bun run playground` (http://localhost:4400). Bun bundles the page, its TSX and its CSS itself.
 */
import page from './index.html'

const port = Number(process.env.PORT ?? 4400)
Bun.serve({ port, hostname: '127.0.0.1', routes: { '/': page }, development: process.env.NODE_ENV !== 'production' })
console.log(`Playground on http://127.0.0.1:${port}/`)
