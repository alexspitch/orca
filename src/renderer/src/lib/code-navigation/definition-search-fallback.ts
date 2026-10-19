import type {
  CodeDefinitionResult,
  CodeDefinitionSearchMatch,
  CodeNavigationDocument,
  CodeNavigationLanguageId
} from './code-navigation-types'
import { definitionSearchIncludeGlobs, isUnsearchableIdentifier } from './code-navigation-languages'
import { lineRange } from './source-text-positions'

// Why: Cmd+hover asks for a definition on every word the pointer crosses; a short abortable wait
// keeps that from running a workspace search per word.
export const DEFINITION_SEARCH_DELAY_MS = 120
const SEARCH_MAX_MATCHES = 50
export const DEFINITION_SEARCH_MAX_RESULTS = 10

const JS_IDENT = 'A-Za-z0-9_$'
const PY_IDENT = 'A-Za-z0-9_'

function escapeEre(name: string): string {
  return name.replace(/[$.*+?^()[\]{}|\\]/g, '\\$&')
}

// Why ERE without `\b`/`\s`: the host falls back to `git grep --extended-regexp` when ripgrep is
// unavailable, and POSIX ERE has neither.
export function buildDefinitionSearchRegex(
  languageId: CodeNavigationLanguageId,
  name: string
): string {
  const n = escapeEre(name)
  const ws = '[[:space:]]'
  if (languageId === 'python') {
    const end = `([^${PY_IDENT}]|$)`
    return [
      `^${ws}*(async${ws}+)?def${ws}+${n}${ws}*[(\\[]`,
      `^${ws}*class${ws}+${n}${end}`,
      `^${n}${ws}*(:[^=]*)?=([^=]|$)`,
      `^${ws}*self\\.${n}${ws}*(:[^=]*)?=([^=]|$)`,
      // Dataclass/pydantic fields; trailing `,`/`)` would be a multi-line parameter instead.
      `^${ws}+${n}${ws}*:${ws}*[^=,)]*(=[^=,)]*)?$`
    ].join('|')
  }
  const before = `(^|[^${JS_IDENT}])`
  const end = `([^${JS_IDENT}]|$)`
  const modifiers =
    '(public|private|protected|static|readonly|async|abstract|override|declare|get|set)'
  return [
    `${before}(function\\*?|class|interface|type|enum|namespace|const|let|var)${ws}+${n}${end}`,
    // A method signature that opens its body on the same line.
    `^${ws}*(${modifiers}${ws}+)*\\*?${n}${ws}*(<.*>)?\\(.*\\)[^;=]*\\{${ws}*$`,
    // A modifier rules out a call statement, so a multi-line signature can match on its first line.
    `^${ws}*(${modifiers}${ws}+)+\\*?${n}${ws}*(<.*>)?\\(`,
    // Arrow-function properties, object-literal methods and function-typed members.
    `${before}${n}[?!]?${ws}*[:=]${ws}*(async${ws}*)?(\\([^)]*\\)|[A-Za-z_$][${JS_IDENT}]*)${ws}*(:[^=]*)?=>`
  ].join('|')
}

/** Column of `name` inside the matched text, falling back to its first whole-word use on the line. */
function nameColumnInMatch(
  match: CodeDefinitionSearchMatch,
  name: string,
  identChars: string
): number | null {
  const wordPattern = new RegExp(
    `(^|[^${identChars}])(${name.replace(/[$]/g, '\\$')})(?![${identChars}])`
  )
  const displayColumn = match.column
  const matchedText = match.lineContent.slice(
    displayColumn - 1,
    displayColumn - 1 + match.matchLength
  )
  const inMatch = wordPattern.exec(matchedText)
  if (inMatch) {
    return displayColumn + inMatch.index + inMatch[1].length
  }
  const inLine = wordPattern.exec(match.lineContent)
  return inLine ? inLine.index + inLine[1].length + 1 : null
}

function sharedPrefixSegments(a: string, b: string): number {
  const left = a.split('/')
  const right = b.split('/')
  let count = 0
  while (count < left.length - 1 && count < right.length - 1 && left[count] === right[count]) {
    count++
  }
  return count
}

function waitAbortable(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Last-resort definition lookup: a workspace regex search for declarations of `name`.
 * Returns [] (not null) because it is the final step of every built-in engine.
 */
export async function findDefinitionsBySearch(params: {
  doc: CodeNavigationDocument
  name: string
  /** The cursor's own line in this document, so the usage itself is never offered. */
  excludeLine?: number
  signal: AbortSignal
  delayMs?: number
}): Promise<CodeDefinitionResult[]> {
  const { doc, name, signal } = params
  if (!doc.files || isUnsearchableIdentifier(doc.languageId, name)) {
    return []
  }
  await waitAbortable(params.delayMs ?? DEFINITION_SEARCH_DELAY_MS, signal)
  const matches = await doc.files.searchDefinitions(
    {
      regex: buildDefinitionSearchRegex(doc.languageId, name),
      includeGlobs: definitionSearchIncludeGlobs(doc.languageId),
      maxResults: SEARCH_MAX_MATCHES
    },
    signal
  )
  const identChars = doc.languageId === 'python' ? PY_IDENT : JS_IDENT
  const sourcePath = doc.relativePath ?? ''
  const seen = new Set<string>()
  const ranked: { result: CodeDefinitionResult; score: [number, number, string] }[] = []
  for (const match of matches) {
    const isSameFile = match.relativePath === doc.relativePath
    if (isSameFile && match.line === params.excludeLine) {
      continue
    }
    const column = nameColumnInMatch(match, name, identChars)
    const key = `${match.relativePath}:${match.line}`
    if (column === null || seen.has(key)) {
      continue
    }
    seen.add(key)
    ranked.push({
      result: {
        target: isSameFile
          ? { kind: 'same' }
          : { kind: 'workspace', relativePath: match.relativePath },
        range: lineRange(match.line, column, name.length),
        source: 'search'
      },
      score: [
        isSameFile ? 1 : 0,
        sharedPrefixSegments(sourcePath, match.relativePath),
        `${match.relativePath}:${String(match.line).padStart(8, '0')}`
      ]
    })
  }
  ranked.sort(
    (a, b) =>
      b.score[0] - a.score[0] || b.score[1] - a.score[1] || a.score[2].localeCompare(b.score[2])
  )
  return ranked.slice(0, DEFINITION_SEARCH_MAX_RESULTS).map((entry) => entry.result)
}
