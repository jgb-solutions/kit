/**
 * Installs the packed package into empty projects and checks, after `bun run build`, in CI:
 * 1. without any optional peer dependency (no Better Auth, oRPC or React): kit/access (jose alone),
 *    kit/auth/rules and kit/auth/expo load and type-check;
 * 2. tree-shaking: an app bundle that imports kit/access and kit/auth/rules holds no admin or React
 *    code (the namespaces are separate files, nothing shared);
 * 3. with React alone: kit/admin loads, renders on the server without React warnings, ships its
 *    stylesheet (kit/admin/styles.css) and type-checks.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const STANDALONE = ['access', 'auth/rules', 'auth/expo'] as const

const run = (cmd: string[], cwd: string) => {
  const result = Bun.spawnSync(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0) {
    console.error(`✗ ${cmd.join(' ')}\n${result.stdout.toString()}${result.stderr.toString()}`)
    process.exit(1)
  }
  return result.stdout.toString()
}

const dir = mkdtempSync(join(tmpdir(), 'kit-install-'))
try {
  const packed = run(['bun', 'pm', 'pack', '--ignore-scripts', '--destination', dir], process.cwd())
  const tarball = packed.match(/\S+\.tgz/)?.[0]
  if (!tarball) throw new Error(`bun pm pack gave no tarball:\n${packed}`)
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'kit-install-check', private: true, type: 'module' }))
  run(['bun', 'add', join(dir, tarball.split('/').pop()!)], dir)
  run(['bun', 'add', '-d', 'typescript@6.0.3'], dir)

  const installed = run(['bun', 'pm', 'ls'], dir)
  for (const peer of ['better-auth', '@better-auth/passkey', '@orpc/server', 'react', 'react-dom'])
    if (installed.includes(`${peer}@`)) throw new Error(`${peer} was installed, but it should be optional`)

  const imports = STANDALONE.map((sub, i) => `import * as m${i} from '@jgb-solutions/kit/${sub}'`).join('\n')
  const uses = STANDALONE.map((sub, i) => `if (Object.keys(m${i}).length === 0) throw new Error('${sub} exports nothing')`).join('\n')
  writeFileSync(join(dir, 'check.ts'), `${imports}\n${uses}\nconsole.log('loaded')\n`)
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        target: 'es2022',
        lib: ['es2022', 'dom'],
        noEmit: true,
        skipLibCheck: false,
        types: [],
      },
      include: ['check.ts'],
    }),
  )
  run(['bun', 'check.ts'], dir)
  run(['bunx', 'tsc', '-p', 'tsconfig.json'], dir)
  console.log(`✓ ${STANDALONE.map((sub) => `kit/${sub}`).join(', ')} load and type-check without Better Auth, oRPC or React installed`)

  // 2. Tree-shaking: a bundle of an app that uses kit/access and kit/auth/rules.
  writeFileSync(
    join(dir, 'app.ts'),
    `import * as access from '@jgb-solutions/kit/access'\nimport * as rules from '@jgb-solutions/kit/auth/rules'\nconsole.log(Object.keys(access).length + Object.keys(rules).length)\n`,
  )
  const bundled = await Bun.build({ entrypoints: [join(dir, 'app.ts')], target: 'browser', minify: true })
  if (!bundled.success) throw new Error(`the app bundle failed: ${bundled.logs.join('\n')}`)
  const code = (await Promise.all(bundled.outputs.map((output) => output.text()))).join('\n')
  for (const marker of ['ja-root', 'AdminShell', 'react', 'createElement', 'jsx'])
    if (code.includes(marker)) throw new Error(`an app using kit/access and kit/auth/rules bundles "${marker}" (admin or React code)`)
  console.log(`✓ an app bundle with kit/access and kit/auth/rules holds no admin or React code (${(code.length / 1024).toFixed(1)} KB)`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}

// 3. kit/admin with React alone.
const ADMIN_CHECK = `import { renderToString } from 'react-dom/server'
import * as admin from '@jgb-solutions/kit/admin'
import { AdminShell, BarChart, Button, DataTable, LineChart, PageHeader, PageSize, icons } from '@jgb-solutions/kit/admin'

const css = await Bun.file(Bun.resolveSync('@jgb-solutions/kit/admin/styles.css', import.meta.dir)).text()
if (!css.includes('.ja-root')) throw new Error('admin/styles.css has no .ja-root')

const problems: unknown[] = []
console.error = (...args: unknown[]) => problems.push(args.join(' '))
const html = renderToString(
  <AdminShell
    app={{ name: 'Check', mark: 'C' }}
    nav={[{ items: [
      { key: 'home', label: 'Home', href: '/', icon: <icons.home />, current: true },
      { key: 'users', label: 'Users', href: '/users', icon: <icons.users />, count: 3 },
    ] }]}
    user={{ name: 'Ada Lovelace', role: 'Admin' }}
  >
    <PageHeader title="Check" />
    <Button>Save</Button>
    <DataTable
      label="People"
      columns={[{ key: 'name', header: 'Name', cell: (row: { name: string }) => row.name, sort: {} }]}
      rows={[{ name: 'Ada' }]}
      rowKey={(row) => row.name}
      sort={{ key: 'name', direction: 'asc' }}
      onSortChange={() => {}}
    />
    <PageSize value={50} onChange={() => {}} />
    <LineChart data={[{ label: 'a', value: 1 }, { label: 'b', value: 3 }]} label="Line" />
    <BarChart labels={['a', 'b']} series={[{ label: 'x', values: [1, 2] }]} label="Bars" />
  </AdminShell>,
)
if (problems.length > 0) throw new Error('React warned while rendering:\\n' + problems.join('\\n'))
if (!html.includes('ja-root') || !html.includes('<table') || !html.includes('aria-sort="ascending"')) throw new Error('the render is missing parts')
console.log(Object.keys(admin).length + ' exports')
`

const adminDir = mkdtempSync(join(tmpdir(), 'kit-admin-install-'))
try {
  const packed = run(['bun', 'pm', 'pack', '--ignore-scripts', '--destination', adminDir], process.cwd())
  const tarball = packed.match(/\S+\.tgz/)?.[0]
  if (!tarball) throw new Error(`bun pm pack gave no tarball:\n${packed}`)
  writeFileSync(join(adminDir, 'package.json'), JSON.stringify({ name: 'kit-admin-install-check', private: true, type: 'module' }))
  run(['bun', 'add', join(adminDir, tarball.split('/').pop()!), 'react@19', 'react-dom@19'], adminDir)
  run(['bun', 'add', '-d', 'typescript@6.0.3', '@types/react@19', '@types/react-dom@19', '@types/bun'], adminDir)
  writeFileSync(join(adminDir, 'check.tsx'), ADMIN_CHECK)
  writeFileSync(
    join(adminDir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        target: 'es2022',
        lib: ['es2022', 'dom'],
        jsx: 'react-jsx',
        noEmit: true,
        skipLibCheck: false,
        types: ['bun'],
      },
      include: ['check.tsx'],
    }),
  )
  const loaded = run(['bun', 'check.tsx'], adminDir).trim()
  run(['bunx', 'tsc', '-p', 'tsconfig.json'], adminDir)
  console.log(`✓ kit/admin installs with React alone, renders without warnings and type-checks (${loaded})`)
} finally {
  rmSync(adminDir, { recursive: true, force: true })
}
