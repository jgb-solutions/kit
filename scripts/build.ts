/**
 * Builds the package: one ESM file per subpath export (dist/<name>.js), their type declarations
 * (tsc, tsconfig.build.json), and kit/admin's stylesheet (dist/admin/styles.css, from
 * src/admin/styles/*.css in name order). Dependencies stay external, so the app's bundler dedupes them.
 */
import { readdirSync, rmSync } from 'node:fs'
import { entrypoints } from './entrypoints'

rmSync('dist', { recursive: true, force: true })

const result = await Bun.build({
  entrypoints: entrypoints().map((entry) => entry.source),
  outdir: 'dist',
  root: 'src',
  format: 'esm',
  // Runtime-neutral: Web Crypto and fetch only, so Bun, Node and Cloudflare Workers all run it.
  target: 'browser',
  packages: 'external',
  splitting: false,
  minify: false,
  sourcemap: 'none',
  // kit/admin: the production JSX runtime (react/jsx-runtime), whatever NODE_ENV the build runs with.
  jsx: { development: false },
})
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

// kit/admin's one stylesheet: 00-tokens.css first. The app imports it once ('@jgb-solutions/kit/admin/styles.css').
const sheets = readdirSync('src/admin/styles')
  .filter((name) => name.endsWith('.css'))
  .sort()
await Bun.write('dist/admin/styles.css', (await Promise.all(sheets.map((name) => Bun.file(`src/admin/styles/${name}`).text()))).join('\n'))

const types = Bun.spawnSync(['bunx', 'tsc', '-p', 'tsconfig.build.json'], { stdout: 'inherit', stderr: 'inherit' })
if (types.exitCode !== 0) process.exit(types.exitCode ?? 1)
console.log(`Built ${result.outputs.length} module(s) and their types in dist/.`)
