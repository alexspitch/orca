import type {
  CodeDefinitionResult,
  CodeNavigationDocument,
  CodeNavigationEngine,
  CodePosition
} from './code-navigation-types'
import { isUnsearchableIdentifier } from './code-navigation-languages'
import { findDefinitionsBySearch } from './definition-search-fallback'
import type { PythonBinding, PythonModuleReference } from './python-binding-types'
import { resolvePythonReference, type PythonImportHop } from './python-definition-lookup'
import { PythonImportResolver, type PythonHopTarget } from './python-import-hops'
import { isInsidePythonStringOrComment } from './python-logical-lines'
import { getPythonSyntaxTree, type PythonSyntaxTree } from './python-syntax-tree'
import { identifierAtPosition, lineRange, offsetRangeToCodeRange } from './source-text-positions'

type DefinitionRequest = {
  doc: CodeNavigationDocument
  tree: PythonSyntaxTree
  name: string
  position: CodePosition
  signal: AbortSignal
  resolver: PythonImportResolver | null
}

function documentTree(doc: CodeNavigationDocument): PythonSyntaxTree {
  return getPythonSyntaxTree(doc.text, `doc:${doc.modelUri}`)
}

function bindingRange(
  tree: PythonSyntaxTree,
  binding: PythonBinding
): CodeDefinitionResult['range'] {
  return offsetRangeToCodeRange(
    tree.scan.lineStarts,
    binding.offset,
    binding.offset + binding.name.length
  )
}

function sameFileResult(tree: PythonSyntaxTree, binding: PythonBinding): CodeDefinitionResult {
  return { target: { kind: 'same' }, range: bindingRange(tree, binding), source: 'semantic' }
}

function hopResult(doc: CodeNavigationDocument, target: PythonHopTarget): CodeDefinitionResult {
  return {
    target:
      target.relativePath === doc.relativePath
        ? { kind: 'same' }
        : { kind: 'workspace', relativePath: target.relativePath },
    range:
      target.kind === 'module' ? lineRange(1, 1, 0) : bindingRange(target.tree, target.binding),
    source: 'import'
  }
}

function searchFor(request: DefinitionRequest, name: string): Promise<CodeDefinitionResult[]> {
  if (isUnsearchableIdentifier('python', name)) {
    return Promise.resolve([])
  }
  return findDefinitionsBySearch({
    doc: request.doc,
    name,
    excludeLine: request.position.lineNumber,
    signal: request.signal
  })
}

function moduleReferenceAt(
  tree: PythonSyntaxTree,
  offset: number
): { reference: PythonModuleReference; segment: number; importedName: string | null } | null {
  for (const reference of tree.moduleReferences) {
    const segment = reference.segments.findIndex((token) => token.offset === offset)
    if (segment !== -1) {
      return { reference, segment, importedName: null }
    }
    const imported = reference.importedNames.find((token) => token.offset === offset)
    if (imported) {
      return { reference, segment: -1, importedName: imported.name }
    }
  }
  return null
}

/** A module path segment or an imported name inside an import statement; null when elsewhere. */
async function importStatementDefinitions(
  request: DefinitionRequest,
  resolver: PythonImportResolver,
  offset: number
): Promise<CodeDefinitionResult[] | null> {
  const found = moduleReferenceAt(request.tree, offset)
  if (!found) {
    return null
  }
  const { reference, segment, importedName } = found
  const fromPath = request.doc.relativePath
  const module = reference.segments.map((token) => token.name)
  if (importedName === null) {
    const modulePath = await resolver.resolveModule(
      reference.level,
      module.slice(0, segment + 1).join('.'),
      fromPath
    )
    return modulePath ? [hopResult(request.doc, { kind: 'module', relativePath: modulePath })] : []
  }
  const target = await resolver.importedName(
    fromPath,
    reference.level,
    module.join('.'),
    importedName,
    0
  )
  return target ? [hopResult(request.doc, target)] : searchFor(request, importedName)
}

async function importedDefinitions(
  request: DefinitionRequest,
  hops: readonly PythonImportHop[]
): Promise<CodeDefinitionResult[]> {
  const [first] = hops
  const ownLocation = first.path.length === 0 && !first.viaBaseClass
  if (!request.resolver) {
    return ownLocation ? [sameFileResult(request.tree, first.binding)] : []
  }
  for (const hop of hops) {
    const target = await request.resolver.followHop(request.doc.relativePath, hop, 0)
    if (target) {
      return [hopResult(request.doc, target)]
    }
  }
  const source = first.binding.importSource
  if (ownLocation && source?.kind === 'module') {
    return [sameFileResult(request.tree, first.binding)]
  }
  const searchName =
    first.path.at(-1) ?? (source?.kind === 'from' ? source.name : first.binding.name)
  const searched = await searchFor(request, searchName)
  if (searched.length > 0 || !ownLocation) {
    return searched
  }
  return [sameFileResult(request.tree, first.binding)]
}

async function unresolvedDefinitions(
  request: DefinitionRequest,
  attribute: boolean
): Promise<CodeDefinitionResult[]> {
  const { tree, name, resolver } = request
  if (isUnsearchableIdentifier('python', name)) {
    return []
  }
  if (!attribute && resolver) {
    for (const star of tree.starImports) {
      const modulePath = await resolver.resolveModule(
        star.level,
        star.module,
        request.doc.relativePath
      )
      const target = modulePath ? await resolver.moduleMember(modulePath, name, 1) : null
      if (target) {
        return [hopResult(request.doc, target)]
      }
    }
  }
  return searchFor(request, name)
}

export async function findPythonDefinitions(
  doc: CodeNavigationDocument,
  position: CodePosition,
  signal: AbortSignal
): Promise<CodeDefinitionResult[]> {
  const tree = documentTree(doc)
  const identifier = identifierAtPosition(doc.text, tree.scan.lineStarts, position, false)
  if (!identifier || isInsidePythonStringOrComment(tree.scan, identifier.startOffset)) {
    return []
  }
  const resolver = doc.files ? new PythonImportResolver(doc.files, signal) : null
  const request: DefinitionRequest = {
    doc,
    tree,
    name: identifier.name,
    position,
    signal,
    resolver
  }
  if (resolver) {
    const fromImport = await importStatementDefinitions(request, resolver, identifier.startOffset)
    if (fromImport) {
      return fromImport
    }
  }
  const resolution = resolvePythonReference(tree, identifier.name, identifier.startOffset)
  switch (resolution.kind) {
    case 'local':
      return [sameFileResult(tree, resolution.binding)]
    case 'imported':
      return importedDefinitions(request, resolution.hops)
    case 'unresolved':
      return unresolvedDefinitions(request, resolution.attribute)
  }
}

export const pythonCodeNavigationEngine: CodeNavigationEngine = {
  id: 'builtin-python',
  supports: (languageId) => languageId === 'python',
  getOutline: (doc) => Promise.resolve(documentTree(doc).outline),
  getDefinitions: findPythonDefinitions
}
