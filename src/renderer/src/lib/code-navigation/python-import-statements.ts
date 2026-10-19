import type {
  PythonModuleReference,
  PythonNameToken,
  PythonStatementFacts
} from './python-binding-types'
import {
  closingIndex,
  isPythonKeyword,
  makeBinding,
  splitTopLevel,
  type PythonToken
} from './python-statement-tokens'

function isModuleName(token: PythonToken | undefined): token is PythonToken {
  return token !== undefined && token.kind === 'name' && !isPythonKeyword(token.text)
}

function readDottedName(
  tokens: readonly PythonToken[],
  from: number,
  to: number
): { segments: PythonNameToken[]; next: number } {
  const segments: PythonNameToken[] = []
  let k = from
  while (k < to && isModuleName(tokens[k])) {
    segments.push({ name: tokens[k].text, offset: tokens[k].start })
    k++
    if (k + 1 < to && tokens[k].text === '.' && isModuleName(tokens[k + 1])) {
      k++
    } else {
      break
    }
  }
  return { segments, next: k }
}

function aliasAfter(
  tokens: readonly PythonToken[],
  index: number,
  end: number
): PythonToken | null {
  const alias = tokens[index + 1]
  return tokens[index]?.text === 'as' && index + 1 < end && isModuleName(alias) ? alias : null
}

/** `import a.b.c, d.e as f` — `tokens[from]` is `import`. */
export function parseImportStatement(
  tokens: readonly PythonToken[],
  from: number,
  to: number,
  facts: PythonStatementFacts,
  line: number
): void {
  for (const [start, end] of splitTopLevel(tokens, from + 1, to, ',')) {
    const { segments, next } = readDottedName(tokens, start, end)
    if (segments.length === 0) {
      continue
    }
    facts.moduleReferences.push({ level: 0, segments, importedNames: [] })
    const alias = aliasAfter(tokens, next, end)
    if (alias) {
      const module = segments.map((segment) => segment.name).join('.')
      facts.bindings.push(makeBinding(alias, 'import', line, { kind: 'module', module }))
    } else {
      facts.bindings.push(
        makeBinding(tokens[start], 'import', line, { kind: 'module', module: segments[0].name })
      )
    }
  }
}

/** `from ..a.b import (c, d as e)` / `from x import *` — `tokens[from]` is `from`. */
export function parseFromImportStatement(
  tokens: readonly PythonToken[],
  from: number,
  to: number,
  facts: PythonStatementFacts,
  line: number
): void {
  let k = from + 1
  let level = 0
  while (k < to && (tokens[k].text === '.' || tokens[k].text === '...')) {
    level += tokens[k].text.length
    k++
  }
  const { segments, next } = readDottedName(tokens, k, to)
  const reference: PythonModuleReference = { level, segments, importedNames: [] }
  facts.moduleReferences.push(reference)
  if (tokens[next]?.text !== 'import' || next >= to) {
    return
  }
  const module = segments.map((segment) => segment.name).join('.')
  let namesStart = next + 1
  let namesEnd = to
  if (tokens[namesStart]?.text === '(') {
    namesEnd = Math.min(closingIndex(tokens, namesStart), to)
    namesStart++
  }
  if (tokens[namesStart]?.text === '*') {
    facts.starImports.push({ level, module })
    return
  }
  for (const [start, end] of splitTopLevel(tokens, namesStart, namesEnd, ',')) {
    const nameToken = tokens[start]
    if (!isModuleName(nameToken)) {
      continue
    }
    reference.importedNames.push({ name: nameToken.text, offset: nameToken.start })
    const bound = aliasAfter(tokens, start + 1, end) ?? nameToken
    facts.bindings.push(
      makeBinding(bound, 'import', line, { kind: 'from', level, module, name: nameToken.text })
    )
  }
}
