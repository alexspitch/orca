import { describe, expect, it } from 'vitest'
import { createInMemoryFiles } from './in-memory-code-navigation-files-test-fixture'
import { resolveTsModule } from './ts-module-resolution'

const signal = new AbortController().signal

function resolveIn(entries: Record<string, string>, specifier: string, from: string) {
  return resolveTsModule(createInMemoryFiles(entries).files, specifier, from, signal)
}

describe('resolveTsModule relative specifiers', () => {
  it('resolves extensionless paths in TypeScript priority order', async () => {
    const files = { 'src/a.ts': '', 'src/a.tsx': '', 'src/a.js': '' }
    expect(await resolveIn(files, './a', 'src/main.ts')).toBe('src/a.ts')
    expect(await resolveIn({ 'src/a.tsx': '', 'src/a.js': '' }, './a', 'src/main.ts')).toBe(
      'src/a.tsx'
    )
    expect(await resolveIn({ 'src/a.d.ts': '', 'src/a.js': '' }, './a', 'src/main.ts')).toBe(
      'src/a.d.ts'
    )
    expect(await resolveIn({ 'src/a.js': '' }, './a', 'src/main.ts')).toBe('src/a.js')
  })

  it('walks up with ../ and handles . and ..', async () => {
    expect(await resolveIn({ 'lib/x.ts': '' }, '../../lib/x', 'src/deep/main.ts')).toBe('lib/x.ts')
    expect(await resolveIn({ 'src/index.ts': '' }, '.', 'src/main.ts')).toBe('src/index.ts')
    expect(await resolveIn({ 'index.tsx': '' }, '..', 'src/main.ts')).toBe('index.tsx')
  })

  it('prefers a file over a directory index', async () => {
    const files = { 'src/util.ts': '', 'src/util/index.ts': '' }
    expect(await resolveIn(files, './util', 'src/main.ts')).toBe('src/util.ts')
    expect(await resolveIn({ 'src/util/index.js': '' }, './util', 'src/main.ts')).toBe(
      'src/util/index.js'
    )
  })

  it('maps .js/.jsx/.mjs/.cjs imports to their TypeScript sources first', async () => {
    expect(await resolveIn({ 'a.ts': '', 'a.js': '' }, './a.js', 'm.ts')).toBe('a.ts')
    expect(await resolveIn({ 'a.tsx': '' }, './a.js', 'm.ts')).toBe('a.tsx')
    expect(await resolveIn({ 'a.d.ts': '' }, './a.jsx', 'm.ts')).toBe('a.d.ts')
    expect(await resolveIn({ 'a.js': '' }, './a.js', 'm.ts')).toBe('a.js')
    expect(await resolveIn({ 'a.mts': '', 'a.mjs': '' }, './a.mjs', 'm.ts')).toBe('a.mts')
    expect(await resolveIn({ 'a.d.mts': '' }, './a.mjs', 'm.ts')).toBe('a.d.mts')
    expect(await resolveIn({ 'a.cts': '' }, './a.cjs', 'm.ts')).toBe('a.cts')
  })

  it('takes paths with a TypeScript or JSON extension as written', async () => {
    expect(await resolveIn({ 'a.ts': '' }, './a.ts', 'm.ts')).toBe('a.ts')
    expect(await resolveIn({ 'data.json': '' }, './data.json', 'm.ts')).toBe('data.json')
    expect(await resolveIn({ 'data.json.ts': '' }, './data.json', 'm.ts')).toBeNull()
  })

  it('opens a non-code import as written after code candidates', async () => {
    expect(await resolveIn({ 'styles.css': '' }, './styles.css', 'm.ts')).toBe('styles.css')
    expect(
      await resolveIn({ 'styles.css': '', 'styles.css.d.ts': '' }, './styles.css', 'm.ts')
    ).toBe('styles.css.d.ts')
  })

  it('rejects specifiers escaping the workspace root', async () => {
    expect(await resolveIn({ 'x.ts': '' }, '../../x', 'src/m.ts')).toBeNull()
  })

  it('uses exactly one existence probe', async () => {
    const { files, existingCalls } = createInMemoryFiles({ 'src/util/index.ts': '' })
    expect(await resolveTsModule(files, './util', 'src/main.ts', signal)).toBe('src/util/index.ts')
    expect(existingCalls).toHaveLength(1)
    expect(existingCalls[0]).toEqual([
      'src/util.ts',
      'src/util.tsx',
      'src/util.d.ts',
      'src/util.js',
      'src/util.jsx',
      'src/util.mjs',
      'src/util.cjs',
      'src/util.mts',
      'src/util.cts',
      'src/util/index.ts',
      'src/util/index.tsx',
      'src/util/index.d.ts',
      'src/util/index.js',
      'src/util/index.jsx',
      'src/util/index.mjs',
      'src/util/index.cjs',
      'src/util/index.mts',
      'src/util/index.cts'
    ])
  })
})

describe('resolveTsModule non-relative specifiers', () => {
  const tsconfig = JSON.stringify({
    compilerOptions: {
      baseUrl: '.',
      paths: {
        '@/*': ['src/*'],
        '@/components/*': ['src/ui/*', 'legacy/components/*'],
        'exact-alias': ['src/exact.ts'],
        'exact-*': ['src/wild/*'],
        '*.svg': ['assets/*.svg']
      }
    }
  })

  it('resolves wildcard paths with the longest prefix', async () => {
    const files = { 'tsconfig.json': tsconfig, 'src/lib/x.ts': '', 'src/ui/button.tsx': '' }
    expect(await resolveIn(files, '@/lib/x', 'src/main.ts')).toBe('src/lib/x.ts')
    expect(await resolveIn(files, '@/components/button', 'src/main.ts')).toBe('src/ui/button.tsx')
  })

  it('tries each target of the matched pattern in order', async () => {
    const files = { 'tsconfig.json': tsconfig, 'legacy/components/old.ts': '' }
    expect(await resolveIn(files, '@/components/old', 'src/main.ts')).toBe(
      'legacy/components/old.ts'
    )
  })

  it('prefers an exact pattern over a matching wildcard', async () => {
    const files = { 'tsconfig.json': tsconfig, 'src/exact.ts': '', 'src/wild/alias.ts': '' }
    expect(await resolveIn(files, 'exact-alias', 'src/main.ts')).toBe('src/exact.ts')
    expect(await resolveIn(files, 'exact-other', 'src/main.ts')).toBeNull()
  })

  it('matches patterns with a suffix', async () => {
    const files = { 'tsconfig.json': tsconfig, 'assets/logo.svg': '' }
    expect(await resolveIn(files, 'logo.svg', 'src/main.ts')).toBe('assets/logo.svg')
  })

  it('falls back to baseUrl when the mapped targets do not exist', async () => {
    const files = { 'tsconfig.json': tsconfig, '@/odd.ts': '', 'shared/x.ts': '' }
    expect(await resolveIn(files, '@/odd', 'src/main.ts')).toBe('@/odd.ts')
    expect(await resolveIn(files, 'shared/x', 'src/main.ts')).toBe('shared/x.ts')
  })

  it('resolves through baseUrl alone', async () => {
    const files = {
      'app/tsconfig.json': '{ "compilerOptions": { "baseUrl": "./src" } }',
      'app/src/services/api.ts': ''
    }
    expect(await resolveIn(files, 'services/api', 'app/src/main.ts')).toBe(
      'app/src/services/api.ts'
    )
  })

  it('resolves paths relative to the config directory without baseUrl', async () => {
    const files = {
      'app/tsconfig.json': '{ "compilerOptions": { "paths": { "~/*": ["./src/*"] } } }',
      'app/src/a.ts': ''
    }
    expect(await resolveIn(files, '~/a', 'app/src/deep/main.ts')).toBe('app/src/a.ts')
  })

  it('returns null for bare packages', async () => {
    expect(await resolveIn({ 'tsconfig.json': tsconfig }, 'react', 'src/main.ts')).toBeNull()
    expect(await resolveIn({}, 'react', 'src/main.ts')).toBeNull()
  })

  it('rejects mapped targets escaping the root', async () => {
    const files = {
      'tsconfig.json': '{ "compilerOptions": { "paths": { "x/*": ["../outside/*"] } } }'
    }
    const { files: access, existingCalls } = createInMemoryFiles(files)
    expect(await resolveTsModule(access, 'x/a', 'main.ts', signal)).toBeNull()
    expect(existingCalls).toHaveLength(1)
  })

  it('probes all mapped and baseUrl candidates in a single call', async () => {
    const { files, existingCalls } = createInMemoryFiles({
      'tsconfig.json': tsconfig,
      'legacy/components/card/index.ts': ''
    })
    expect(await resolveTsModule(files, '@/components/card', 'src/main.ts', signal)).toBe(
      'legacy/components/card/index.ts'
    )
    // One probe for the config lookup, one for every module candidate.
    expect(existingCalls).toHaveLength(2)
    expect(existingCalls[1]).toContain('src/ui/card.ts')
    expect(existingCalls[1]).toContain('@/components/card/index.cts')
  })
})
