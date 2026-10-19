import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CodeNavigationDocument, CodeNavigationEngine } from './code-navigation-types'
import {
  getCodeDefinitions,
  getCodeOutline,
  onDidChangeCodeNavigationAvailability,
  registerCodeNavigationEngine
} from './code-navigation-engine-registry'

const doc: CodeNavigationDocument = {
  modelUri: 'file:///a.py',
  languageId: 'python',
  text: '',
  version: 1,
  relativePath: 'a.py',
  files: null
}
const range = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 2 }

function engine(id: string, answer: 'null' | 'empty' | 'hit' | 'throw'): CodeNavigationEngine {
  const result = async () => {
    if (answer === 'throw') {
      throw new Error(id)
    }
    return answer === 'null'
      ? null
      : answer === 'empty'
        ? []
        : [{ target: { kind: 'same' as const }, range, source: 'semantic' as const }]
  }
  return {
    id,
    supports: (languageId) => languageId === 'python',
    getOutline: async () => (answer === 'hit' ? [] : null),
    getDefinitions: vi.fn(result)
  }
}

const cleanups: (() => void)[] = []
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
})

describe('code navigation engine registry', () => {
  it('asks higher priority first and falls through on null or failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const low = engine('low', 'hit')
    const failing = engine('failing', 'throw')
    const declining = engine('declining', 'null')
    cleanups.push(registerCodeNavigationEngine(low, 0))
    cleanups.push(registerCodeNavigationEngine(failing, 50))
    cleanups.push(registerCodeNavigationEngine(declining, 100))
    const results = await getCodeDefinitions(
      doc,
      { lineNumber: 1, column: 1 },
      new AbortController().signal
    )
    expect(results).toHaveLength(1)
    expect(declining.getDefinitions).toHaveBeenCalled()
    expect(failing.getDefinitions).toHaveBeenCalled()
  })

  it('treats an empty answer as final', async () => {
    const empty = engine('empty', 'empty')
    const low = engine('low', 'hit')
    cleanups.push(registerCodeNavigationEngine(empty, 10))
    cleanups.push(registerCodeNavigationEngine(low, 0))
    expect(
      await getCodeDefinitions(doc, { lineNumber: 1, column: 1 }, new AbortController().signal)
    ).toEqual([])
    expect(low.getDefinitions).not.toHaveBeenCalled()
  })

  it('returns an empty outline when nobody answers and notifies on registration', async () => {
    const listener = vi.fn()
    const unsubscribe = onDidChangeCodeNavigationAvailability(listener)
    cleanups.push(unsubscribe)
    cleanups.push(registerCodeNavigationEngine(engine('declining', 'null')))
    expect(listener).toHaveBeenCalled()
    expect(await getCodeOutline(doc, new AbortController().signal)).toEqual([])
  })
})
