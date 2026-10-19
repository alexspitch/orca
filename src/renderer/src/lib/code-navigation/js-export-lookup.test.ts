import { describe, expect, it } from 'vitest'
import type { CodeRange } from './code-navigation-types'
import { cachedJsModuleSyntax, findExportedDeclaration } from './js-export-lookup'
import { createInMemoryFiles } from './in-memory-code-navigation-files-test-fixture'

const signal = new AbortController().signal

function r(line: number, column: number, endColumn: number): CodeRange {
  return { startLineNumber: line, startColumn: column, endLineNumber: line, endColumn }
}

function lookupIn(entries: Record<string, string>, relativePath: string, exportName: string) {
  return findExportedDeclaration({
    files: createInMemoryFiles(entries).files,
    relativePath,
    exportName,
    signal
  })
}

describe('findExportedDeclaration', () => {
  it('finds named, default and renamed local exports', async () => {
    const files = {
      'a.ts': [
        'export function named() {}',
        'const inner = 1',
        'class Widget {}',
        'export default Widget',
        'export { inner as renamed }'
      ].join('\n')
    }
    expect(await lookupIn(files, 'a.ts', 'named')).toEqual({
      relativePath: 'a.ts',
      range: r(1, 17, 22)
    })
    expect(await lookupIn(files, 'a.ts', 'default')).toEqual({
      relativePath: 'a.ts',
      range: r(3, 7, 13)
    })
    expect(await lookupIn(files, 'a.ts', 'renamed')).toEqual({
      relativePath: 'a.ts',
      range: r(2, 7, 12)
    })
    expect(await lookupIn(files, 'a.ts', 'inner')).toEqual({
      relativePath: 'a.ts',
      range: r(2, 7, 12)
    })
  })

  it('lands on the default keyword of an anonymous default export', async () => {
    const files = { 'a.ts': '\nexport default () => 1' }
    expect(await lookupIn(files, 'a.ts', 'default')).toEqual({
      relativePath: 'a.ts',
      range: r(2, 8, 15)
    })
  })

  it('returns the file start for the namespace name', async () => {
    expect(await lookupIn({ 'a.ts': 'x' }, 'a.ts', '*')).toEqual({
      relativePath: 'a.ts',
      range: r(1, 1, 1)
    })
  })

  it('follows re-export chains through index files', async () => {
    const files = {
      'lib/index.ts':
        "export { Button as default, helper } from './ui'\nexport { default as Card } from './card'",
      'lib/ui/index.ts': "export { Button } from './button'\nexport { helper } from '../helper.js'",
      'lib/ui/button.tsx': 'export const Button = () => null',
      'lib/helper.ts': '\n\nexport function helper() {}',
      'lib/card.tsx': 'export default function Card() {}'
    }
    expect(await lookupIn(files, 'lib/index.ts', 'default')).toEqual({
      relativePath: 'lib/ui/button.tsx',
      range: r(1, 14, 20)
    })
    expect(await lookupIn(files, 'lib/index.ts', 'helper')).toEqual({
      relativePath: 'lib/helper.ts',
      range: r(3, 17, 23)
    })
    expect(await lookupIn(files, 'lib/index.ts', 'Card')).toEqual({
      relativePath: 'lib/card.tsx',
      range: r(1, 25, 29)
    })
  })

  it('searches star exports in order but never for default', async () => {
    const files = {
      'index.ts': "export * from './a'\nexport * from './b'",
      'a.ts': 'const hidden = 1\nexport const fromA = 1\nexport default 1',
      'b.ts': 'export const hidden = 2\nexport const fromA = 2'
    }
    expect(await lookupIn(files, 'index.ts', 'fromA')).toEqual({
      relativePath: 'a.ts',
      range: r(2, 14, 19)
    })
    expect(await lookupIn(files, 'index.ts', 'hidden')).toEqual({
      relativePath: 'b.ts',
      range: r(1, 14, 20)
    })
    expect(await lookupIn(files, 'index.ts', 'default')).toBeNull()
  })

  it('resolves export * as ns to the target module start', async () => {
    const files = {
      'index.ts': "export * as utils from './utils'",
      'utils.ts': 'export const x = 1'
    }
    expect(await lookupIn(files, 'index.ts', 'utils')).toEqual({
      relativePath: 'utils.ts',
      range: r(1, 1, 1)
    })
  })

  it('follows imports that are re-exported locally', async () => {
    const files = {
      'index.ts':
        "import { a } from './x'\nimport * as all from './x'\nimport def from './d'\nexport { a, all, def as D }",
      'x.ts': 'export const a = 1',
      'd.ts': 'export default class Thing {}'
    }
    expect(await lookupIn(files, 'index.ts', 'a')).toEqual({
      relativePath: 'x.ts',
      range: r(1, 14, 15)
    })
    expect(await lookupIn(files, 'index.ts', 'all')).toEqual({
      relativePath: 'x.ts',
      range: r(1, 1, 1)
    })
    expect(await lookupIn(files, 'index.ts', 'D')).toEqual({
      relativePath: 'd.ts',
      range: r(1, 22, 27)
    })
  })

  it('falls back to the import binding or re-export when the module cannot be resolved', async () => {
    const files = {
      'index.ts':
        "import { useState } from 'react'\nexport { useState }\nexport { useEffect } from 'react'"
    }
    expect(await lookupIn(files, 'index.ts', 'useState')).toEqual({
      relativePath: 'index.ts',
      range: r(1, 10, 18)
    })
    expect(await lookupIn(files, 'index.ts', 'useEffect')).toEqual({
      relativePath: 'index.ts',
      range: r(3, 10, 19)
    })
  })

  it('stops on cycles', async () => {
    const files = {
      'a.ts': "export * from './b'\nexport { loop } from './b'",
      'b.ts': "export * from './a'\nexport { loop } from './a'"
    }
    expect(await lookupIn(files, 'a.ts', 'missing')).toBeNull()
    // The hop back into a.ts is cut, so the last re-export reached is the answer.
    expect(await lookupIn(files, 'a.ts', 'loop')).toEqual({
      relativePath: 'b.ts',
      range: r(2, 10, 14)
    })
  })

  it('stops after the maximum depth', async () => {
    const chain: Record<string, string> = { 'f6.ts': 'export const deep = 1' }
    for (let i = 0; i < 6; i++) {
      chain[`f${i}.ts`] = `export * from './f${i + 1}'`
    }
    expect(await lookupIn(chain, 'f2.ts', 'deep')).toEqual({
      relativePath: 'f6.ts',
      range: r(1, 14, 18)
    })
    expect(await lookupIn(chain, 'f0.ts', 'deep')).toBeNull()
  })

  it('falls back to an unexported top-level declaration at the entry file only', async () => {
    const files = {
      'globals.d.ts': 'declare function globalHelper(): void\ninterface Window { x: 1 }',
      'index.ts': "export * from './inner'",
      'inner.ts': 'const secret = 1'
    }
    expect(await lookupIn(files, 'globals.d.ts', 'globalHelper')).toEqual({
      relativePath: 'globals.d.ts',
      range: r(1, 18, 30)
    })
    expect(await lookupIn(files, 'index.ts', 'secret')).toBeNull()
  })

  it('reads CommonJS exports', async () => {
    const files = {
      'lib.js': [
        "const dep = require('./dep')",
        'function add() {}',
        'module.exports = { add, sub: add, dep, inline() {} }'
      ].join('\n'),
      'dep.js': 'exports.value = 42',
      'single.js': 'class Service {}\nmodule.exports = Service',
      'index.js': "module.exports = require('./lib')"
    }
    expect(await lookupIn(files, 'lib.js', 'add')).toEqual({
      relativePath: 'lib.js',
      range: r(2, 10, 13)
    })
    expect(await lookupIn(files, 'lib.js', 'sub')).toEqual({
      relativePath: 'lib.js',
      range: r(2, 10, 13)
    })
    expect(await lookupIn(files, 'lib.js', 'dep')).toEqual({
      relativePath: 'dep.js',
      range: r(1, 1, 1)
    })
    expect(await lookupIn(files, 'lib.js', 'inline')).toEqual({
      relativePath: 'lib.js',
      range: r(3, 40, 46)
    })
    expect(await lookupIn(files, 'lib.js', 'default')).toEqual({
      relativePath: 'lib.js',
      range: r(3, 1, 15)
    })
    expect(await lookupIn(files, 'dep.js', 'value')).toEqual({
      relativePath: 'dep.js',
      range: r(1, 9, 14)
    })
    expect(await lookupIn(files, 'single.js', 'default')).toEqual({
      relativePath: 'single.js',
      range: r(1, 7, 14)
    })
    expect(await lookupIn(files, 'index.js', 'add')).toEqual({
      relativePath: 'lib.js',
      range: r(2, 10, 13)
    })
  })

  it('returns null for a missing file', async () => {
    expect(await lookupIn({}, 'nope.ts', 'x')).toBeNull()
  })

  it('rejects when the signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      findExportedDeclaration({
        files: createInMemoryFiles({ 'a.ts': 'export const a = 1' }).files,
        relativePath: 'a.ts',
        exportName: 'a',
        signal: controller.signal
      })
    ).rejects.toBeDefined()
  })

  it('reuses a parse while the text is unchanged', () => {
    const first = cachedJsModuleSyntax('scope:x.ts', 'export const a = 1')
    expect(cachedJsModuleSyntax('scope:x.ts', 'export const a = 1')).toBe(first)
    expect(cachedJsModuleSyntax('scope:x.ts', 'export const b = 1')).not.toBe(first)
  })
})
