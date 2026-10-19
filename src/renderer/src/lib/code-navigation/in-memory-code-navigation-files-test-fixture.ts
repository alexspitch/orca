import type { CodeNavigationFileAccess } from './code-navigation-types'

let scopeCounter = 0

/** File access over an in-memory map; a fresh `cacheScope` per call keeps module caches apart. */
export function createInMemoryFiles(entries: Record<string, string>): {
  files: CodeNavigationFileAccess
  contents: Map<string, string>
  existingCalls: string[][]
  readCalls: string[]
} {
  const contents = new Map(Object.entries(entries))
  const existingCalls: string[][] = []
  const readCalls: string[] = []
  const files: CodeNavigationFileAccess = {
    cacheScope: `in-memory-${++scopeCounter}`,
    async readText(relativePath) {
      readCalls.push(relativePath)
      return contents.get(relativePath) ?? null
    },
    async existing(relativePaths) {
      existingCalls.push([...relativePaths])
      return new Set(relativePaths.filter((path) => contents.has(path)))
    },
    async searchDefinitions() {
      return []
    }
  }
  return { files, contents, existingCalls, readCalls }
}
