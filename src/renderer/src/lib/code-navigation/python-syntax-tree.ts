import type { CodeOutlineSymbol } from './code-navigation-types'
import type {
  PythonAttributeAssignment,
  PythonBaseReference,
  PythonBinding,
  PythonModuleReference,
  PythonStarImport,
  PythonStatementFacts
} from './python-binding-types'
import { parsePythonLine, type PythonDefinitionHeader } from './python-binding-statements'
import {
  scanPythonSource,
  type PythonLogicalLine,
  type PythonSourceScan
} from './python-logical-lines'
import {
  addVariableOutlineSymbols,
  createOutlineContainer,
  definitionSymbolKind,
  pushOutlineSymbol,
  pythonLineEndColumn,
  type PythonOutlineContainer
} from './python-outline-symbols'

export type PythonScope = {
  kind: 'module' | 'class' | 'function'
  parent: PythonScope | null
  /** The def/class binding in the parent scope; null for the module. */
  definition: PythonBinding | null
  /** Offsets the scope governs: from the def name (class: past its header colon) to the block end. */
  start: number
  end: number
  bindings: PythonBinding[]
  parameters: PythonBinding[]
  globals: Set<string>
  nonlocals: Set<string>
  attributes: PythonAttributeAssignment[]
  bases: PythonBaseReference[]
  children: PythonScope[]
}

export type PythonSyntaxTree = {
  scan: PythonSourceScan
  module: PythonScope
  /** def/class binding → the scope of its body. */
  definitionScopes: Map<PythonBinding, PythonScope>
  outline: CodeOutlineSymbol[]
  starImports: PythonStarImport[]
  moduleReferences: PythonModuleReference[]
}

type BlockFrame = {
  scope: PythonScope
  indent: number
  container: PythonOutlineContainer
  symbol: CodeOutlineSymbol | null
}

function createScope(
  kind: PythonScope['kind'],
  parent: PythonScope | null,
  definition: PythonBinding | null,
  start: number,
  end: number
): PythonScope {
  return {
    kind,
    parent,
    definition,
    start,
    end,
    bindings: [],
    parameters: [],
    globals: new Set(),
    nonlocals: new Set(),
    attributes: [],
    bases: [],
    children: []
  }
}

class PythonTreeBuilder {
  readonly tree: PythonSyntaxTree
  private readonly root: BlockFrame
  private readonly stack: BlockFrame[]

  constructor(private readonly scan: PythonSourceScan) {
    const module = createScope('module', null, null, 0, scan.text.length)
    this.tree = {
      scan,
      module,
      definitionScopes: new Map(),
      outline: [],
      starImports: [],
      moduleReferences: []
    }
    this.root = {
      scope: module,
      indent: -1,
      container: createOutlineContainer(this.tree.outline, ''),
      symbol: null
    }
    this.stack = [this.root]
  }

  build(): PythonSyntaxTree {
    const { lines, code } = this.scan
    let decoratorStart: number | null = null
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]
      this.closeBlocksDeeperThan(line.indent, index - 1)
      const frame = this.top()
      const parsed = parsePythonLine(code, line.start, line.end, index)
      this.addFacts(frame.scope, parsed.facts)
      if (parsed.isDecorator) {
        decoratorStart ??= index
        continue
      }
      if (parsed.definition) {
        const child = this.openDefinition(frame, parsed.definition, decoratorStart ?? index, line)
        if (parsed.opensBlock) {
          this.stack.push(child)
        } else {
          this.closeBlock(child, index)
        }
      } else if (frame.scope.kind !== 'function') {
        addVariableOutlineSymbols(this.scan, frame.container, parsed.facts.bindings, line)
      }
      decoratorStart = null
    }
    this.closeBlocksDeeperThan(-1, lines.length - 1)
    return this.tree
  }

  private top(): BlockFrame {
    return this.stack.at(-1) ?? this.root
  }

  private closeBlocksDeeperThan(indent: number, lastLine: number): void {
    while (this.stack.length > 1 && indent <= this.top().indent) {
      const frame = this.stack.pop()
      if (frame) {
        this.closeBlock(frame, lastLine)
      }
    }
  }

  private closeBlock(frame: BlockFrame, lastLine: number): void {
    const line = this.scan.lines[lastLine]
    frame.scope.end = line.end
    if (frame.symbol) {
      frame.symbol.range.endLineNumber = line.endLine + 1
      frame.symbol.range.endColumn = pythonLineEndColumn(this.scan, line.endLine)
    }
  }

  private addFacts(scope: PythonScope, facts: PythonStatementFacts): void {
    scope.bindings.push(...facts.bindings)
    scope.attributes.push(...facts.attributes)
    for (const name of facts.globals) {
      scope.globals.add(name)
    }
    for (const name of facts.nonlocals) {
      scope.nonlocals.add(name)
    }
    this.tree.starImports.push(...facts.starImports)
    this.tree.moduleReferences.push(...facts.moduleReferences)
  }

  private openDefinition(
    frame: BlockFrame,
    header: PythonDefinitionHeader,
    rangeStartLine: number,
    line: PythonLogicalLine
  ): BlockFrame {
    const { binding } = header
    const isClass = header.kind === 'class'
    const scopeStart = isClass ? header.bodyOffset : binding.offset + binding.name.length
    const scope = createScope(
      isClass ? 'class' : 'function',
      frame.scope,
      binding,
      scopeStart,
      line.end
    )
    scope.parameters = header.parameters
    scope.bindings.push(...header.parameters)
    scope.bases = header.bases
    frame.scope.children.push(scope)
    this.tree.definitionScopes.set(binding, scope)
    const symbol = pushOutlineSymbol(
      this.scan,
      frame.container,
      binding,
      definitionSymbolKind(binding, frame.scope.kind),
      this.scan.lines[rangeStartLine].start,
      line.endLine
    )
    const child: BlockFrame = {
      scope,
      indent: line.indent,
      container: createOutlineContainer(symbol.children, `${symbol.id}/`),
      symbol
    }
    if (header.inlineBody) {
      this.addFacts(scope, header.inlineBody)
      if (isClass) {
        addVariableOutlineSymbols(this.scan, child.container, header.inlineBody.bindings, line)
      }
    }
    return child
  }
}

export function parsePythonSyntaxTree(text: string): PythonSyntaxTree {
  return new PythonTreeBuilder(scanPythonSource(text)).build()
}

const TREE_CACHE_LIMIT = 32
const treeCache = new Map<string, { text: string; tree: PythonSyntaxTree }>()

/** Parses through a small LRU keyed by `cacheKey`; a different `text` replaces the entry. */
export function getPythonSyntaxTree(text: string, cacheKey: string): PythonSyntaxTree {
  const cached = treeCache.get(cacheKey)
  treeCache.delete(cacheKey)
  const entry =
    cached && cached.text === text ? cached : { text, tree: parsePythonSyntaxTree(text) }
  treeCache.set(cacheKey, entry)
  if (treeCache.size > TREE_CACHE_LIMIT) {
    const oldest = treeCache.keys().next()
    if (!oldest.done) {
      treeCache.delete(oldest.value)
    }
  }
  return entry.tree
}

/** The innermost def/class scope governing `offset`. */
export function pythonScopeAt(tree: PythonSyntaxTree, offset: number): PythonScope {
  let scope = tree.module
  for (;;) {
    const child = scope.children.find(
      (candidate) => candidate.start <= offset && offset < candidate.end
    )
    if (!child) {
      return scope
    }
    scope = child
  }
}
