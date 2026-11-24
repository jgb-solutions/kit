/**
 * Checks what would be published, before every publish (prepublishOnly) and in CI:
 * - every subpath export's JavaScript and types exist, and each module loads with its named exports;
 * - each module imports only what it may (IMPORTS below): `access` jose alone, `auth/rules` and
 *   `auth/expo` nothing, so an app using only those never needs Better Auth or oRPC installed;
 * - only jose is a dependency; Better Auth, its passkey plugin and oRPC are optional peer dependencies;
 * - the tarball holds only dist/, README.md, CHANGELOG.md, LICENSE and package.json (no sources, tests or secrets);
 * - repository.url names this repo (npm's provenance and trusted publishing require it);
 * - nothing app-specific slipped in: no Access team other than the examples, no 32/64-character hex
 *   IDs (Access AUD tags, account IDs), no addresses outside example.com (README, "What never goes in").
 */
import { existsSync, readFileSync } from 'node:fs'
import pkg from '../package.json'
import { entrypoints } from './entrypoints'

const problems: string[] = []

/** What each module may import (package names, subpaths included). Anything else fails. */
const IMPORTS: Record<string, readonly string[]> = {
  './access': ['jose'],
  './auth': ['better-auth', '@better-auth/passkey'],
  './auth/bun': [],
  './auth/orpc': ['@orpc/server'],
  './auth/rules': [],
  './auth/expo': [],
}
const OPTIONAL_PEERS = ['better-auth', '@better-auth/passkey', '@orpc/server']

const packageOf = (specifier: string) =>
  specifier
    .split('/')
    .slice(0, specifier.startsWith('@') ? 2 : 1)
    .join('/')

if (pkg.license !== 'MIT') problems.push(`license is ${pkg.license}, not MIT`)
if (pkg.repository.url !== 'git+https://github.com/jgb-solutions/kit.git') problems.push(`repository.url is ${pkg.repository.url}`)

for (const entry of entrypoints()) {
  for (const file of [entry.js, entry.types]) if (!existsSync(file)) problems.push(`${entry.subpath}: ${file} is missing (bun run build)`)
  if (!existsSync(entry.js)) continue
  const allowed = IMPORTS[entry.subpath]
  if (!allowed) problems.push(`${entry.subpath}: not listed in IMPORTS (scripts/check-package.ts)`)
  // Bare imports only: the build bundles the package's own files, so a relative import means a module leaked out.
  const code = readFileSync(entry.js, 'utf8')
  // The types count too: an app importing only kit/access must type-check without Better Auth.
  const types = existsSync(entry.types) ? readFileSync(entry.types, 'utf8') : ''
  for (const [, specifier] of types.matchAll(/^\s*(?:import|export)\b[^\n]*?\bfrom\s*['"]([^'"]+)['"]/gm)) {
    if (specifier && !specifier.startsWith('.') && !allowed?.includes(packageOf(specifier)))
      problems.push(`${entry.subpath}: its types import ${specifier}, which they may not`)
  }
  const specifiers = [
    ...code.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g), // import … from 'x', export … from 'x'
    ...code.matchAll(/\bimport\s*['"]([^'"]+)['"]/g), // import 'x'
    ...code.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g), // import('x')
    ...code.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g), // require('x')
  ].map((match) => match[1]!)
  for (const specifier of specifiers) {
    if (specifier.startsWith('.')) problems.push(`${entry.subpath}: imports the file ${specifier} (should be bundled)`)
    else if (!allowed?.includes(packageOf(specifier))) problems.push(`${entry.subpath}: imports ${specifier}, which it may not`)
  }
  const module = (await import(`../${entry.js}`)) as Record<string, unknown>
  if (Object.keys(module).length === 0) problems.push(`${entry.subpath}: ${entry.js} exports nothing`)
}

const dependencies = Object.keys(pkg.dependencies)
if (dependencies.join() !== 'jose') problems.push(`dependencies must be jose alone, not: ${dependencies.join(', ')}`)
const peers: Record<string, string> = pkg.peerDependencies
const peerMeta: Record<string, { optional?: boolean }> = pkg.peerDependenciesMeta
for (const name of OPTIONAL_PEERS) {
  if (!peers[name]) problems.push(`${name} is not a peer dependency`)
  if (peerMeta[name]?.optional !== true) problems.push(`${name} is not an optional peer dependency (peerDependenciesMeta)`)
}
for (const name of Object.keys(peers)) if (!OPTIONAL_PEERS.includes(name)) problems.push(`unexpected peer dependency ${name}`)

// What the tarball would hold, from Bun's own packer (`packed <size> <path>` lines).
const pack = Bun.spawnSync(['bun', 'pm', 'pack', '--dry-run', '--ignore-scripts'], { stdout: 'pipe', stderr: 'pipe' })
if (pack.exitCode !== 0) problems.push(`bun pm pack failed: ${pack.stderr.toString().trim()}`)
const files = [...pack.stdout.toString().matchAll(/^packed\s+\S+\s+(\S+)$/gm)].map((match) => match[1]!)
if (files.length === 0) problems.push('bun pm pack listed no files')
const publishable = /^(dist\/([\w-]+\/)?[\w.-]+\.(js|d\.ts)|README\.md|CHANGELOG\.md|LICENSE|package\.json)$/
for (const file of files) if (!publishable.test(file)) problems.push(`the tarball would include ${file}`)

const forbidden: [RegExp, string][] = [
  [/(?<![\w-])(?!example-team\b)[a-z0-9-]+\.cloudflareaccess\.com/g, 'an Access team domain'],
  [/\b[0-9a-f]{64}\b|\b[0-9a-f]{32}\b/g, 'a 32- or 64-character hex ID'],
  [/[\w.+-]+@(?!example\.com\b)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}\b/gi, 'an email address outside example.com'],
]
for (const file of files.filter((path) => /\.(js|ts|md|json)$/.test(path))) {
  const text = readFileSync(file, 'utf8')
  for (const [pattern, what] of forbidden)
    for (const match of text.matchAll(pattern)) problems.push(`${file} contains ${what}: ${match[0]}`)
}

if (problems.length) {
  for (const problem of problems) console.error(`✗ ${problem}`)
  process.exit(1)
}
console.log(`✓ ${files.length} files to publish: ${files.join(', ')}`)
