import type { PythonBinding } from './python-binding-types'
import { parsePythonExpressionLocals } from './python-clause-targets'
import { logicalLineIndexAt } from './python-logical-lines'
import { pythonScopeAt, type PythonScope, type PythonSyntaxTree } from './python-syntax-tree'

export type PythonImportHop = {
  /** An import binding of the tree it was found in. */
  binding: PythonBinding
  /** Attributes to follow from the import's target: module members, then class members. */
  path: string[]
  /** Reached through a base class, which spends the base-class hop budget. */
  viaBaseClass: boolean
}

export type PythonReferenceResolution =
  | { kind: 'local'; binding: PythonBinding }
  /** Candidates to try in order. */
  | { kind: 'imported'; hops: PythonImportHop[] }
  | { kind: 'unresolved'; attribute: boolean }

export type PythonReceiver =
  | { kind: 'names'; names: { name: string; offset: number }[] }
  | { kind: 'super' }
  /** A call, subscript or literal: not statically resolvable here. */
  | { kind: 'expression' }

type MemberResolution = Exclude<PythonReferenceResolution, { kind: 'unresolved' }> | null

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[\w\u0080-￿]/.test(ch)
}

function skipSpaceBackward(code: string, index: number): number {
  let i = index
  while (i >= 0 && code.charCodeAt(i) <= 32) {
    i--
  }
  return i
}

function matchingOpenParen(code: string, closeIndex: number): number {
  let depth = 0
  for (let i = closeIndex; i >= 0; i--) {
    if (code[i] === ')') {
      depth++
    } else if (code[i] === '(' && --depth === 0) {
      return i
    }
  }
  return -1
}

/** What sits before `.name` at `nameOffset` in blanked code; null when it is not an attribute. */
export function pythonReceiverBefore(code: string, nameOffset: number): PythonReceiver | null {
  let dot = skipSpaceBackward(code, nameOffset - 1)
  if (dot < 0 || code[dot] !== '.') {
    return null
  }
  const names: { name: string; offset: number }[] = []
  for (;;) {
    const end = skipSpaceBackward(code, dot - 1)
    if (code[end] === ')' && names.length === 0) {
      const open = matchingOpenParen(code, end)
      const calleeEnd = skipSpaceBackward(code, open - 1)
      const calleeStart = calleeEnd - 'super'.length + 1
      const isSuper =
        open > 0 &&
        code.slice(calleeStart, calleeEnd + 1) === 'super' &&
        !isWordChar(code[calleeStart - 1])
      return isSuper ? { kind: 'super' } : { kind: 'expression' }
    }
    let start = end + 1
    while (start > 0 && isWordChar(code[start - 1])) {
      start--
    }
    if (start > end || /\d/.test(code[start])) {
      return { kind: 'expression' }
    }
    names.unshift({ name: code.slice(start, end + 1), offset: start })
    dot = skipSpaceBackward(code, start - 1)
    if (dot < 0 || code[dot] !== '.') {
      return { kind: 'names', names }
    }
  }
}

function pickBinding(
  scope: PythonScope,
  name: string,
  offset: number,
  cursorLine: number
): PythonBinding | null {
  const candidates = scope.bindings.filter((binding) => binding.name === name)
  const exact = candidates.find((binding) => binding.offset === offset)
  if (exact) {
    return exact
  }
  const definite = candidates.filter((binding) => binding.kind !== 'augmented')
  const pool = definite.length > 0 ? definite : candidates
  let nearestBefore: PythonBinding | null = null
  for (const binding of pool) {
    if (binding.line < cursorLine) {
      nearestBefore = binding
    }
  }
  return nearestBefore ?? pool[0] ?? null
}

/** Python name resolution: function scopes outward (skipping enclosing class bodies), then module. */
export function lookupPythonName(
  tree: PythonSyntaxTree,
  name: string,
  offset: number
): PythonBinding | null {
  const lineIndex = logicalLineIndexAt(tree.scan, offset)
  const line = tree.scan.lines[lineIndex]
  if (line) {
    const locals = parsePythonExpressionLocals(tree.scan.code, line.start, line.end, lineIndex)
    const local = locals.find((binding) => binding.name === name)
    if (local) {
      return local
    }
  }
  let scope: PythonScope | null = pythonScopeAt(tree, offset)
  let innermost = true
  while (scope) {
    if (scope.kind === 'class' && !innermost) {
      scope = scope.parent
      continue
    }
    if (scope.globals.has(name)) {
      return (
        pickBinding(tree.module, name, offset, lineIndex) ??
        pickBinding(scope, name, offset, lineIndex)
      )
    }
    if (!scope.nonlocals.has(name)) {
      const found = pickBinding(scope, name, offset, lineIndex)
      if (found) {
        return found
      }
    }
    innermost = false
    scope = scope.parent
  }
  return null
}

/** The method (and its class) whose first parameter is `receiver`, looking out through closures. */
function methodForReceiver(scope: PythonScope, receiver: string): PythonScope | null {
  let current: PythonScope | null = scope
  while (current?.kind === 'function') {
    const parameter = current.parameters.find((candidate) => candidate.name === receiver)
    if (parameter) {
      return current.parent?.kind === 'class' && current.parameters[0] === parameter
        ? current
        : null
    }
    if (current.bindings.some((binding) => binding.name === receiver)) {
      return null
    }
    current = current.parent
  }
  return null
}

function enclosingMethod(scope: PythonScope): PythonScope | null {
  let current: PythonScope | null = scope
  while (current?.kind === 'function') {
    if (current.parent?.kind === 'class') {
      return current
    }
    current = current.parent
  }
  return null
}

function classScopeForPath(
  tree: PythonSyntaxTree,
  binding: PythonBinding,
  path: readonly string[]
): PythonScope | null {
  let scope = tree.definitionScopes.get(binding)
  for (const segment of path) {
    const member = scope?.bindings.find(
      (candidate) => candidate.name === segment && candidate.kind === 'class'
    )
    scope = member ? tree.definitionScopes.get(member) : undefined
  }
  return scope?.kind === 'class' ? scope : null
}

function attributesAssignedIn(scope: PythonScope, receiver: string, name: string): PythonBinding[] {
  const own = scope.attributes
    .filter((attribute) => attribute.receiver === receiver && attribute.binding.name === name)
    .map((attribute) => attribute.binding)
  const nested = scope.children
    .filter((child) => child.kind === 'function')
    .flatMap((child) => attributesAssignedIn(child, receiver, name))
  return [...own, ...nested]
}

/** `self.name = ...` in the class's methods, `__init__` first. */
function instanceAttribute(classScope: PythonScope, name: string): PythonBinding | null {
  const methods = classScope.children.filter((child) => child.kind === 'function')
  const ordered = [
    ...methods.filter((method) => method.definition?.name === '__init__'),
    ...methods.filter((method) => method.definition?.name !== '__init__')
  ]
  const assigned = ordered.flatMap((method) => {
    const receiver = method.parameters[0]?.name
    return receiver ? attributesAssignedIn(method, receiver, name) : []
  })
  return assigned.find((binding) => binding.kind !== 'augmented') ?? assigned[0] ?? null
}

function memberFromBases(
  tree: PythonSyntaxTree,
  classScope: PythonScope,
  name: string,
  visited: Set<PythonScope>
): MemberResolution {
  const hops: PythonImportHop[] = []
  for (const base of classScope.bases) {
    const root = lookupPythonName(tree, base.parts[0], base.offset)
    if (root?.kind === 'import') {
      hops.push({ binding: root, path: [...base.parts.slice(1), name], viaBaseClass: true })
      continue
    }
    const baseScope = root ? classScopeForPath(tree, root, base.parts.slice(1)) : null
    const found = baseScope ? findPythonClassMember(tree, baseScope, name, visited) : null
    if (found?.kind === 'local') {
      return found
    }
    if (found?.kind === 'imported') {
      hops.push(...found.hops)
    }
  }
  return hops.length > 0 ? { kind: 'imported', hops } : null
}

/** Class body names, then instance attributes, then base classes (in-file first, then imported). */
export function findPythonClassMember(
  tree: PythonSyntaxTree,
  classScope: PythonScope,
  name: string,
  visited = new Set<PythonScope>()
): MemberResolution {
  if (visited.has(classScope)) {
    return null
  }
  visited.add(classScope)
  const own = classScope.bindings.filter(
    (binding) => binding.name === name && binding.kind !== 'parameter'
  )
  const declared = own.find((binding) => binding.kind !== 'augmented') ?? own[0]
  if (declared) {
    return resolutionForBinding(declared, [])
  }
  const attribute = instanceAttribute(classScope, name)
  if (attribute) {
    return { kind: 'local', binding: attribute }
  }
  return memberFromBases(tree, classScope, name, visited)
}

function resolutionForBinding(binding: PythonBinding, path: string[]): MemberResolution {
  return binding.kind === 'import'
    ? { kind: 'imported', hops: [{ binding, path, viaBaseClass: false }] }
    : { kind: 'local', binding }
}

function resolveAttribute(
  tree: PythonSyntaxTree,
  receiver: PythonReceiver,
  name: string,
  offset: number
): MemberResolution {
  if (receiver.kind === 'expression') {
    return null
  }
  const scope = pythonScopeAt(tree, offset)
  if (receiver.kind === 'super') {
    const method = enclosingMethod(scope)
    return method?.parent ? memberFromBases(tree, method.parent, name, new Set()) : null
  }
  const [root, ...rest] = receiver.names
  const method = methodForReceiver(scope, root.name)
  if (method?.parent) {
    return rest.length === 0 ? findPythonClassMember(tree, method.parent, name) : null
  }
  const binding = lookupPythonName(tree, root.name, root.offset)
  if (!binding) {
    return null
  }
  const path = rest.map((part) => part.name)
  if (binding.kind === 'import') {
    return resolutionForBinding(binding, [...path, name])
  }
  const classScope = classScopeForPath(tree, binding, path)
  return classScope ? findPythonClassMember(tree, classScope, name) : null
}

/** Resolves the identifier `name` starting at `offset` within one parsed file. */
export function resolvePythonReference(
  tree: PythonSyntaxTree,
  name: string,
  offset: number
): PythonReferenceResolution {
  const receiver = pythonReceiverBefore(tree.scan.code, offset)
  if (!receiver) {
    const binding = lookupPythonName(tree, name, offset)
    return (
      (binding && resolutionForBinding(binding, [])) ?? { kind: 'unresolved', attribute: false }
    )
  }
  return resolveAttribute(tree, receiver, name, offset) ?? { kind: 'unresolved', attribute: true }
}
