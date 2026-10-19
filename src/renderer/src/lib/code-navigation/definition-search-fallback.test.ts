import { describe, expect, it, vi } from 'vitest'
import type {
  CodeDefinitionSearchMatch,
  CodeNavigationDocument,
  CodeNavigationFileAccess
} from './code-navigation-types'
import { buildDefinitionSearchRegex, findDefinitionsBySearch } from './definition-search-fallback'

function docWith(
  matches: CodeDefinitionSearchMatch[],
  overrides: Partial<CodeNavigationDocument> = {}
): { doc: CodeNavigationDocument; search: ReturnType<typeof vi.fn> } {
  const search = vi.fn(async () => matches)
  const files: CodeNavigationFileAccess = {
    cacheScope: 'test',
    readText: async () => null,
    existing: async () => new Set(),
    searchDefinitions: search
  }
  return {
    doc: {
      modelUri: 'file:///root/src/app/main.ts',
      languageId: 'typescript',
      text: '',
      version: 1,
      relativePath: 'src/app/main.ts',
      files,
      ...overrides
    },
    search
  }
}

function match(relativePath: string, line: number, lineContent: string, needle: string) {
  const column = lineContent.indexOf(needle) + 1
  return { relativePath, line, column, matchLength: needle.length, lineContent }
}

const ere = (regex: string): RegExp => new RegExp(regex.replace(/\[\[:space:\]\]/g, '\\s'))

describe('buildDefinitionSearchRegex', () => {
  it('matches TS declarations and not plain calls', () => {
    const regex = ere(buildDefinitionSearchRegex('typescript', 'openFile'))
    for (const line of [
      'export function openFile(a) {',
      'export const openFile = () => {}',
      'class openFile {',
      '  async openFile(',
      '  openFile(file: X): void {',
      '  openFile: (file, opts) => {',
      '  openFile?: (file: OpenFile) => string'
    ]) {
      expect(regex.test(line), line).toBe(true)
    }
    for (const line of ['  openFile(file)', 'const x = openFileNow()', '  reopenFile(x) {']) {
      expect(regex.test(line), line).toBe(false)
    }
  })

  it('escapes $ in JS identifiers', () => {
    expect(ere(buildDefinitionSearchRegex('javascript', '$store')).test('const $store = 1')).toBe(
      true
    )
    expect(ere(buildDefinitionSearchRegex('javascript', '$store')).test('const xstore = 1')).toBe(
      false
    )
  })

  it('matches Python defs, classes, assignments and fields', () => {
    const regex = ere(buildDefinitionSearchRegex('python', 'user'))
    for (const line of [
      'def user(self):',
      'async def user():',
      'class user(Base):',
      'user = 1',
      '    self.user = u',
      '    user: str'
    ]) {
      expect(regex.test(line), line).toBe(true)
    }
    for (const line of ['    user,', 'print(user)', 'user == 1', 'username = 1']) {
      expect(regex.test(line), line).toBe(false)
    }
  })

  it('stays portable ERE', () => {
    for (const language of ['typescript', 'python'] as const) {
      expect(buildDefinitionSearchRegex(language, 'x')).not.toMatch(/\\[bswd]/)
    }
  })
})

describe('findDefinitionsBySearch', () => {
  it('ranks same file first, then nearer paths, and drops the cursor line', async () => {
    const { doc } = docWith([
      match('lib/z.ts', 4, 'export function run() {', 'run'),
      match('src/app/util.ts', 2, 'export function run() {', 'run'),
      match('src/app/main.ts', 10, 'function run() {', 'run'),
      match('src/app/main.ts', 20, 'function run() {', 'run')
    ])
    const results = await findDefinitionsBySearch({
      doc,
      name: 'run',
      excludeLine: 20,
      signal: new AbortController().signal,
      delayMs: 0
    })
    expect(results.map((result) => result.target)).toEqual([
      { kind: 'same' },
      { kind: 'workspace', relativePath: 'src/app/util.ts' },
      { kind: 'workspace', relativePath: 'lib/z.ts' }
    ])
    expect(results[0].range).toEqual({
      startLineNumber: 10,
      startColumn: 10,
      endLineNumber: 10,
      endColumn: 13
    })
  })

  it('skips builtins and keywords without searching', async () => {
    const { doc, search } = docWith([], { languageId: 'python', relativePath: 'a.py' })
    const results = await findDefinitionsBySearch({
      doc,
      name: 'print',
      signal: new AbortController().signal,
      delayMs: 0
    })
    expect(results).toEqual([])
    expect(search).not.toHaveBeenCalled()
  })

  it('does not search when the hover is cancelled during the delay', async () => {
    const { doc, search } = docWith([])
    const controller = new AbortController()
    const pending = findDefinitionsBySearch({
      doc,
      name: 'run',
      signal: controller.signal,
      delayMs: 50
    })
    controller.abort()
    await expect(pending).rejects.toBeDefined()
    expect(search).not.toHaveBeenCalled()
  })

  it('returns nothing without a workspace', async () => {
    const { doc } = docWith([], { files: null })
    expect(
      await findDefinitionsBySearch({
        doc,
        name: 'run',
        signal: new AbortController().signal,
        delayMs: 0
      })
    ).toEqual([])
  })
})
