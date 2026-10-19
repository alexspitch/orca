import { describe, expect, it, vi } from 'vitest'
import type {
  CodeDefinitionSearchMatch,
  CodeNavigationDocument,
  CodeNavigationFileAccess,
  CodePosition
} from './code-navigation-types'
import { createTsCodeNavigationEngine } from './ts-code-navigation-engine'
import type { TsWorkerLike } from './ts-worker-client'

const MODEL_URI = 'file:///repo/src/app/main.ts'

function fakeFiles(
  files: Record<string, string>,
  searchMatches: CodeDefinitionSearchMatch[] = []
): CodeNavigationFileAccess {
  return {
    cacheScope: `test-${Math.random()}`,
    readText: async (relativePath) => files[relativePath] ?? null,
    existing: async (relativePaths) => new Set(relativePaths.filter((path) => path in files)),
    searchDefinitions: vi.fn(async () => searchMatches)
  }
}

function documentFor(text: string, files: CodeNavigationFileAccess | null): CodeNavigationDocument {
  return {
    modelUri: MODEL_URI,
    languageId: 'typescript',
    text,
    version: Math.random(),
    relativePath: 'src/app/main.ts',
    files
  }
}

function positionOf(text: string, needle: string, occurrence = 0): CodePosition {
  let offset = -1
  for (let i = 0; i <= occurrence; i++) {
    offset = text.indexOf(needle, offset + 1)
  }
  const before = text.slice(0, offset)
  const lineNumber = before.split('\n').length
  return { lineNumber, column: offset - before.lastIndexOf('\n') }
}

function worker(definitions: unknown, tree: unknown = undefined): TsWorkerLike {
  return {
    getNavigationTree: async () => tree,
    getDefinitionAtPosition: vi.fn(async () => definitions)
  }
}

function engineWith(tsWorker: TsWorkerLike | null) {
  return createTsCodeNavigationEngine({
    getWorker: async () => tsWorker,
    mapForeignDefinition: () => null
  })
}

const signal = new AbortController().signal

describe('ts code navigation engine', () => {
  const source =
    "import { loadUser } from '../lib'\nimport * as api from './api'\n\nloadUser(1)\napi.fetchAll()\n"
  const files = {
    'src/lib/index.ts': "export { loadUser } from './users'\n",
    'src/lib/users.ts': 'export async function loadUser(id: number) {}\n',
    'src/app/api.ts': 'export function fetchAll() {}\n'
  }

  it('hops from the import binding the worker returns to the exported declaration', async () => {
    const bindingOffset = source.indexOf('loadUser')
    const engine = engineWith(
      worker([{ fileName: MODEL_URI, textSpan: { start: bindingOffset, length: 8 } }])
    )
    const results = await engine.getDefinitions(
      documentFor(source, fakeFiles(files)),
      positionOf(source, 'loadUser', 1),
      signal
    )
    expect(results).toEqual([
      {
        target: { kind: 'workspace', relativePath: 'src/lib/users.ts' },
        range: { startLineNumber: 1, startColumn: 23, endLineNumber: 1, endColumn: 31 },
        source: 'import'
      }
    ])
  })

  it('returns local definitions as-is', async () => {
    const text = 'const value = 1\nconsole.log(value)\n'
    const engine = engineWith(worker([{ fileName: MODEL_URI, textSpan: { start: 6, length: 5 } }]))
    const results = await engine.getDefinitions(
      documentFor(text, fakeFiles({})),
      positionOf(text, 'value', 1),
      signal
    )
    expect(results).toEqual([
      {
        target: { kind: 'same' },
        range: { startLineNumber: 1, startColumn: 7, endLineNumber: 1, endColumn: 12 },
        source: 'semantic'
      }
    ])
  })

  it('does not search for standard-library symbols', async () => {
    const text = 'Promise.resolve(1)\n'
    const workspace = fakeFiles({})
    const engine = engineWith(
      worker([{ fileName: 'lib.es2015.promise.d.ts', textSpan: { start: 0, length: 7 } }])
    )
    expect(
      await engine.getDefinitions(documentFor(text, workspace), positionOf(text, 'resolve'), signal)
    ).toEqual([])
    expect(workspace.searchDefinitions).not.toHaveBeenCalled()
  })

  it('resolves namespace-import members when the worker has nothing', async () => {
    const engine = engineWith(worker(undefined))
    const results = await engine.getDefinitions(
      documentFor(source, fakeFiles(files)),
      positionOf(source, 'fetchAll'),
      signal
    )
    expect(results?.[0]?.target).toEqual({ kind: 'workspace', relativePath: 'src/app/api.ts' })
    expect(results?.[0]?.range.startLineNumber).toBe(1)
  })

  it('opens the module when the cursor is on an import path', async () => {
    const engine = engineWith(worker(undefined))
    const results = await engine.getDefinitions(
      documentFor(source, fakeFiles(files)),
      positionOf(source, "/api'"),
      signal
    )
    expect(results).toEqual([
      {
        target: { kind: 'workspace', relativePath: 'src/app/api.ts' },
        range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
        source: 'import'
      }
    ])
  })

  it('falls back to a workspace search for unknown names', async () => {
    const text = 'store.openFile(x)\n'
    const workspace = fakeFiles({}, [
      {
        relativePath: 'src/store/files.ts',
        line: 7,
        column: 3,
        matchLength: 12,
        lineContent: '  openFile: (file) => {'
      }
    ])
    const engine = engineWith(worker(undefined))
    const results = await engine.getDefinitions(
      documentFor(text, workspace),
      positionOf(text, 'openFile'),
      signal
    )
    expect(results).toEqual([
      {
        target: { kind: 'workspace', relativePath: 'src/store/files.ts' },
        range: { startLineNumber: 7, startColumn: 3, endLineNumber: 7, endColumn: 11 },
        source: 'search'
      }
    ])
  })

  it('stays in the file without a workspace', async () => {
    const engine = engineWith(worker(undefined))
    expect(
      await engine.getDefinitions(documentFor(source, null), positionOf(source, 'fetchAll'), signal)
    ).toEqual([])
  })

  it('builds the outline from the navigation tree and declines without a worker', async () => {
    const text = 'function run() {}\n'
    const tree = {
      text: 'file',
      kind: 'module',
      spans: [{ start: 0, length: text.length }],
      childItems: [
        {
          text: 'run',
          kind: 'function',
          spans: [{ start: 0, length: 17 }],
          nameSpan: { start: 9, length: 3 }
        }
      ]
    }
    expect(
      (await engineWith(worker([], tree)).getOutline(documentFor(text, null), signal))?.map(
        (s) => s.name
      )
    ).toEqual(['run'])
    expect(await engineWith(null).getOutline(documentFor(text, null), signal)).toBeNull()
  })
})
