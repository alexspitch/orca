export type CodeNavigationLanguageId = 'typescript' | 'javascript' | 'python'

/** 1-based, like Monaco. */
export type CodePosition = { lineNumber: number; column: number }

/** 1-based, end-exclusive column, like Monaco. */
export type CodeRange = {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

export type CodeSymbolKind =
  | 'module'
  | 'namespace'
  | 'class'
  | 'interface'
  | 'enum'
  | 'enumMember'
  | 'type'
  | 'function'
  | 'method'
  | 'constructor'
  | 'property'
  | 'field'
  | 'variable'
  | 'constant'

export type CodeOutlineSymbol = {
  /** Stable within one document version; unique among siblings' subtrees. */
  id: string
  name: string
  kind: CodeSymbolKind
  /** Whole declaration, decorators included. */
  range: CodeRange
  /** The name token; always inside `range`. */
  selectionRange: CodeRange
  children: CodeOutlineSymbol[]
}

export type CodeDefinitionTarget =
  | { kind: 'same' }
  /** POSIX path relative to the source document's workspace root. */
  | { kind: 'workspace'; relativePath: string }

export type CodeDefinitionResult = {
  target: CodeDefinitionTarget
  range: CodeRange
  source: 'semantic' | 'import' | 'search'
}

export type CodeDefinitionSearchQuery = {
  /** Portable ERE: no `\b`/`\s`, so the git-grep fallback reads it the same as ripgrep. */
  regex: string
  includeGlobs: string
  maxResults: number
}

export type CodeDefinitionSearchMatch = {
  relativePath: string
  line: number
  column: number
  matchLength: number
  lineContent: string
}

/** Host-routed file access for one workspace; paths are POSIX and relative to its root. */
export type CodeNavigationFileAccess = {
  /** Keys caches so equal paths on different hosts or roots never share entries. */
  readonly cacheScope: string
  /** Live editor text when the file is open, else disk; null when missing, binary or too large. */
  readText(relativePath: string, signal: AbortSignal): Promise<string | null>
  /** The subset of `relativePaths` that exist. */
  existing(relativePaths: readonly string[], signal: AbortSignal): Promise<ReadonlySet<string>>
  searchDefinitions(
    query: CodeDefinitionSearchQuery,
    signal: AbortSignal
  ): Promise<CodeDefinitionSearchMatch[]>
}

export type CodeNavigationDocument = {
  /** Monaco model URI string (an edit-tab model or a hidden navigation model). */
  modelUri: string
  languageId: CodeNavigationLanguageId
  text: string
  version: number
  /** POSIX path relative to the workspace root; null when there is no workspace. */
  relativePath: string | null
  /** null limits navigation to this document (diff views, untitled and artifact tabs). */
  files: CodeNavigationFileAccess | null
}

/**
 * One navigation backend. `null` means "cannot answer, ask the next engine"; an empty array
 * means "answered: nothing there".
 */
export type CodeNavigationEngine = {
  readonly id: string
  supports(languageId: CodeNavigationLanguageId): boolean
  getOutline(doc: CodeNavigationDocument, signal: AbortSignal): Promise<CodeOutlineSymbol[] | null>
  getDefinitions(
    doc: CodeNavigationDocument,
    position: CodePosition,
    signal: AbortSignal
  ): Promise<CodeDefinitionResult[] | null>
}
