import { describe, expect, it, vi } from 'vitest'
import type { CodeNavigationFileAccess } from './code-navigation-types'
import { pythonModuleCandidates, resolvePythonModule } from './python-module-resolution'

function fakeFiles(paths: readonly string[]): CodeNavigationFileAccess & {
  existing: ReturnType<typeof vi.fn>
} {
  const set = new Set(paths)
  return {
    cacheScope: 'test',
    readText: () => Promise.resolve(null),
    existing: vi.fn((candidates: readonly string[]) =>
      Promise.resolve(new Set(candidates.filter((candidate) => set.has(candidate))))
    ),
    searchDefinitions: () => Promise.resolve([])
  }
}

describe('pythonModuleCandidates', () => {
  it('tries the root, src, then the importing file’s own and ancestor directories', () => {
    expect(pythonModuleCandidates(0, 'pkg.mod', 'app/sub/main.py')).toEqual([
      'pkg/mod.py',
      'pkg/mod/__init__.py',
      'pkg/mod.pyi',
      'pkg/mod/__init__.pyi',
      'src/pkg/mod.py',
      'src/pkg/mod/__init__.py',
      'src/pkg/mod.pyi',
      'src/pkg/mod/__init__.pyi',
      'app/sub/pkg/mod.py',
      'app/sub/pkg/mod/__init__.py',
      'app/sub/pkg/mod.pyi',
      'app/sub/pkg/mod/__init__.pyi',
      'app/pkg/mod.py',
      'app/pkg/mod/__init__.py',
      'app/pkg/mod.pyi',
      'app/pkg/mod/__init__.pyi'
    ])
  })

  it('caps ancestor roots at six and dedupes src', () => {
    const roots = new Set(
      pythonModuleCandidates(0, 'm', 'src/a/b/c/d/e/f/g/x.py').map((path) =>
        path.slice(0, path.lastIndexOf('m'))
      )
    )
    expect([...roots]).toEqual([
      '',
      'src/',
      'src/a/b/c/d/e/f/g/',
      'src/a/b/c/d/e/f/',
      'src/a/b/c/d/e/',
      'src/a/b/c/d/',
      'src/a/b/c/',
      'src/a/b/'
    ])
  })

  it('resolves relative levels from the importing file’s package', () => {
    expect(pythonModuleCandidates(1, 'sibling', 'pkg/sub/mod.py')[0]).toBe('pkg/sub/sibling.py')
    expect(pythonModuleCandidates(2, 'other', 'pkg/sub/mod.py')[0]).toBe('pkg/other.py')
    expect(pythonModuleCandidates(3, 'top', 'pkg/sub/mod.py')[0]).toBe('top.py')
    expect(pythonModuleCandidates(1, '', 'pkg/sub/mod.py')).toEqual([
      'pkg/sub/__init__.py',
      'pkg/sub/__init__.pyi'
    ])
    expect(pythonModuleCandidates(1, 'a.b', 'pkg/__init__.py')[0]).toBe('pkg/a/b.py')
  })

  it('rejects relative imports that climb above the workspace root', () => {
    expect(pythonModuleCandidates(4, 'x', 'pkg/sub/mod.py')).toEqual([])
    expect(pythonModuleCandidates(2, 'x', 'mod.py')).toEqual([])
  })

  it('rejects relative imports without a document path, and malformed module names', () => {
    expect(pythonModuleCandidates(1, 'x', null)).toEqual([])
    expect(pythonModuleCandidates(0, '', 'a.py')).toEqual([])
    expect(pythonModuleCandidates(0, '..x', 'a.py')).toEqual([])
    expect(pythonModuleCandidates(0, 'a/b', 'a.py')).toEqual([])
  })

  it('drops candidates from an importing path that escapes the root', () => {
    expect(pythonModuleCandidates(1, 'x', '../outside/mod.py')).toEqual([])
    expect(pythonModuleCandidates(0, 'x', '../outside/mod.py')).toEqual([
      'x.py',
      'x/__init__.py',
      'x.pyi',
      'x/__init__.pyi',
      'src/x.py',
      'src/x/__init__.py',
      'src/x.pyi',
      'src/x/__init__.pyi'
    ])
  })
})

describe('resolvePythonModule', () => {
  const signal = new AbortController().signal

  it('picks the first existing candidate with a single existence query', async () => {
    const files = fakeFiles(['src/pkg/mod.py', 'pkg/mod.pyi', 'app/pkg/mod.py'])
    await expect(resolvePythonModule(files, 0, 'pkg.mod', 'app/main.py', signal)).resolves.toBe(
      'pkg/mod.pyi'
    )
    expect(files.existing).toHaveBeenCalledTimes(1)
  })

  it('prefers a module file over a package and a package over stubs', async () => {
    await expect(
      resolvePythonModule(fakeFiles(['pkg/__init__.py', 'pkg.py']), 0, 'pkg', null, signal)
    ).resolves.toBe('pkg.py')
    await expect(
      resolvePythonModule(fakeFiles(['pkg/__init__.py', 'pkg.pyi']), 0, 'pkg', null, signal)
    ).resolves.toBe('pkg/__init__.py')
  })

  it('returns null without querying when there are no candidates', async () => {
    const files = fakeFiles([])
    await expect(resolvePythonModule(files, 1, 'x', null, signal)).resolves.toBeNull()
    expect(files.existing).not.toHaveBeenCalled()
  })

  it('throws once the request is aborted', async () => {
    const controller = new AbortController()
    const files = fakeFiles(['x.py'])
    files.existing.mockImplementation(() => {
      controller.abort()
      return Promise.resolve(new Set(['x.py']))
    })
    await expect(resolvePythonModule(files, 0, 'x', null, controller.signal)).rejects.toThrow()
  })
})
