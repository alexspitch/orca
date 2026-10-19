import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInMemoryFiles } from './in-memory-code-navigation-files-test-fixture'
import {
  loadTsPathMapping,
  resolveWorkspacePath,
  workspaceParentDirectory
} from './tsconfig-path-mapping'

const signal = new AbortController().signal

afterEach(() => {
  vi.restoreAllMocks()
})

describe('workspace path helpers', () => {
  it('joins and normalizes root-relative POSIX paths', () => {
    expect(resolveWorkspacePath('src/a', '../b/./c')).toBe('src/b/c')
    expect(resolveWorkspacePath('', './x')).toBe('x')
    expect(resolveWorkspacePath('src', '..')).toBe('')
    expect(resolveWorkspacePath('src', 'win\\style')).toBe('src/win/style')
  })

  it('rejects paths escaping the root or absolute paths', () => {
    expect(resolveWorkspacePath('src', '../../x')).toBeNull()
    expect(resolveWorkspacePath('', '/etc/passwd')).toBeNull()
    expect(resolveWorkspacePath('', 'C:/x')).toBeNull()
  })

  it('takes the parent directory', () => {
    expect(workspaceParentDirectory('a/b/c.ts')).toBe('a/b')
    expect(workspaceParentDirectory('c.ts')).toBe('')
  })
})

describe('loadTsPathMapping', () => {
  it('parses JSONC with comments and trailing commas', async () => {
    const { files } = createInMemoryFiles({
      'tsconfig.json': `{
        // line comment
        "compilerOptions": {
          /* block */ "baseUrl": "./src",
          "paths": { "@/*": ["app/*",], },
        },
      }`,
      'src/app/main.ts': ''
    })
    expect(await loadTsPathMapping(files, 'src/app/main.ts', signal)).toEqual({
      baseUrl: 'src',
      paths: [{ pattern: '@/*', targets: ['app/*'] }],
      pathsBase: 'src'
    })
  })

  it('resolves paths against the defining config directory when there is no baseUrl', async () => {
    const { files } = createInMemoryFiles({
      'config/tsconfig.base.json': '{ "compilerOptions": { "paths": { "~/*": ["../lib/*"] } } }',
      'packages/web/tsconfig.json': '{ "extends": "../../config/tsconfig.base" }'
    })
    expect(await loadTsPathMapping(files, 'packages/web/src/x.ts', signal)).toEqual({
      baseUrl: null,
      paths: [{ pattern: '~/*', targets: ['../lib/*'] }],
      pathsBase: 'config'
    })
  })

  it('follows a string and array extends chain with child overrides', async () => {
    const { files } = createInMemoryFiles({
      'base.json':
        '{ "compilerOptions": { "baseUrl": "root-base", "paths": { "a": ["base-a"] } } }',
      'mid.json':
        '{ "extends": "./base.json", "compilerOptions": { "paths": { "m/*": ["mid/*"] } } }',
      'other.json': '{ "compilerOptions": { "baseUrl": "other-base" } }',
      'app/tsconfig.json':
        '{ "extends": ["../mid.json", "../other"], "compilerOptions": { "baseUrl": "." } }'
    })
    expect(await loadTsPathMapping(files, 'app/main.ts', signal)).toEqual({
      baseUrl: 'app',
      paths: [{ pattern: 'm/*', targets: ['mid/*'] }],
      pathsBase: 'app'
    })
  })

  it('lets a later array extends override an earlier one', async () => {
    const { files } = createInMemoryFiles({
      'one.json': '{ "compilerOptions": { "baseUrl": "one" } }',
      'two.json': '{ "compilerOptions": { "baseUrl": "two" } }',
      'tsconfig.json': '{ "extends": ["./one.json", "./two.json"] }'
    })
    expect((await loadTsPathMapping(files, 'x.ts', signal))?.baseUrl).toBe('two')
  })

  it('stops following extends after three levels and ignores package extends', async () => {
    const { files } = createInMemoryFiles({
      'l4.json': '{ "compilerOptions": { "baseUrl": "too-deep" } }',
      'l3.json': '{ "extends": "./l4.json" }',
      'l2.json': '{ "extends": "./l3.json" }',
      'l1.json': '{ "extends": "./l2.json" }',
      'tsconfig.json': '{ "extends": "./l1.json" }',
      'pkg/tsconfig.json': '{ "extends": "@tsconfig/node20/tsconfig.json" }'
    })
    expect(await loadTsPathMapping(files, 'x.ts', signal)).toBeNull()
    expect(await loadTsPathMapping(files, 'pkg/x.ts', signal)).toBeNull()
  })

  it('picks the nearest config, tsconfig before jsconfig, with one existence probe', async () => {
    const { files, existingCalls } = createInMemoryFiles({
      'tsconfig.json': '{ "compilerOptions": { "baseUrl": "root" } }',
      'apps/web/jsconfig.json': '{ "compilerOptions": { "baseUrl": "js" } }',
      'apps/web/tsconfig.json': '{ "compilerOptions": { "baseUrl": "ts" } }',
      'apps/api/jsconfig.json': '{ "compilerOptions": { "baseUrl": "." } }'
    })
    expect((await loadTsPathMapping(files, 'apps/web/src/deep/x.ts', signal))?.baseUrl).toBe(
      'apps/web/ts'
    )
    expect(existingCalls).toHaveLength(1)
    expect(existingCalls[0]).toEqual([
      'apps/web/src/deep/tsconfig.json',
      'apps/web/src/deep/jsconfig.json',
      'apps/web/src/tsconfig.json',
      'apps/web/src/jsconfig.json',
      'apps/web/tsconfig.json',
      'apps/web/jsconfig.json',
      'apps/tsconfig.json',
      'apps/jsconfig.json',
      'tsconfig.json',
      'jsconfig.json'
    ])
    expect((await loadTsPathMapping(files, 'apps/api/x.js', signal))?.baseUrl).toBe('apps/api')
    expect((await loadTsPathMapping(files, 'other/x.ts', signal))?.baseUrl).toBe('root')
  })

  it('falls back to a referenced config when a solution-style root has no mapping', async () => {
    const { files } = createInMemoryFiles({
      'tsconfig.json':
        '{ "files": [], "references": [{ "path": "./tsconfig.node.json" }, { "path": "./web" }] }',
      'tsconfig.node.json': '{ "compilerOptions": {} }',
      'web/tsconfig.json': '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }'
    })
    expect(await loadTsPathMapping(files, 'x.ts', signal)).toEqual({
      baseUrl: null,
      paths: [{ pattern: '@/*', targets: ['./src/*'] }],
      pathsBase: 'web'
    })
  })

  it('returns null without a config, without mapping options, or with a baseUrl outside the root', async () => {
    expect(await loadTsPathMapping(createInMemoryFiles({}).files, 'a/b.ts', signal)).toBeNull()
    const plain = createInMemoryFiles({
      'tsconfig.json': '{ "compilerOptions": { "strict": true } }'
    })
    expect(await loadTsPathMapping(plain.files, 'a.ts', signal)).toBeNull()
    const outside = createInMemoryFiles({
      'tsconfig.json': '{ "compilerOptions": { "baseUrl": "..", "paths": { "a": ["b"] } } }'
    })
    expect(await loadTsPathMapping(outside.files, 'a.ts', signal)).toBeNull()
  })

  it('caches config lookups and parses for 60 seconds', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const { files, contents, existingCalls, readCalls } = createInMemoryFiles({
      'tsconfig.json': '{ "compilerOptions": { "baseUrl": "a" } }'
    })
    expect((await loadTsPathMapping(files, 'src/x.ts', signal))?.baseUrl).toBe('a')
    contents.set('tsconfig.json', '{ "compilerOptions": { "baseUrl": "b" } }')
    expect((await loadTsPathMapping(files, 'src/y.ts', signal))?.baseUrl).toBe('a')
    expect((await loadTsPathMapping(files, 'z.ts', signal))?.baseUrl).toBe('a')
    expect(existingCalls).toHaveLength(1)
    expect(readCalls).toHaveLength(1)
    now.mockReturnValue(1_000_000 + 60_001)
    expect((await loadTsPathMapping(files, 'src/x.ts', signal))?.baseUrl).toBe('b')
    expect(existingCalls).toHaveLength(2)
  })

  it('keeps caches apart per cache scope', async () => {
    const first = createInMemoryFiles({
      'tsconfig.json': '{ "compilerOptions": { "baseUrl": "a" } }'
    })
    const second = createInMemoryFiles({
      'tsconfig.json': '{ "compilerOptions": { "baseUrl": "b" } }'
    })
    expect((await loadTsPathMapping(first.files, 'x.ts', signal))?.baseUrl).toBe('a')
    expect((await loadTsPathMapping(second.files, 'x.ts', signal))?.baseUrl).toBe('b')
  })

  it('rejects when the signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const { files } = createInMemoryFiles({ 'tsconfig.json': '{}' })
    await expect(loadTsPathMapping(files, 'x.ts', controller.signal)).rejects.toBeDefined()
  })
})
