/**
 * Installs the packed package into an empty project, without any optional peer dependency, and checks
 * that the modules that don't need them load and type-check there: kit/access (jose alone),
 * kit/auth/rules and kit/auth/expo (nothing). Run after `bun run build`, in CI.
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
  for (const peer of ['better-auth', '@better-auth/passkey', '@orpc/server'])
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
  console.log(`✓ ${STANDALONE.map((sub) => `kit/${sub}`).join(', ')} load and type-check without Better Auth or oRPC installed`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
