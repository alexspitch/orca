export type PythonBindingKind =
  | 'def'
  | 'class'
  | 'parameter'
  /** `=`, annotated, chained and unpacking targets. */
  | 'assignment'
  | 'augmented'
  /** for/with/except/walrus/match-capture/lambda/comprehension targets. */
  | 'target'
  | 'import'
  | 'typeAlias'

export type PythonImportSource =
  /** `import a.b.c` binds `a` to module `a`; `import a.b as c` binds `c` to module `a.b`. */
  { kind: 'module'; module: string } | { kind: 'from'; level: number; module: string; name: string }

export type PythonBinding = {
  name: string
  /** Offset of the name token. */
  offset: number
  kind: PythonBindingKind
  /** Index of the logical line that binds it. */
  line: number
  importSource: PythonImportSource | null
}

/** `receiver.name = ...`; methods keep the ones whose receiver is their first parameter. */
export type PythonAttributeAssignment = { receiver: string; binding: PythonBinding }

export type PythonStarImport = { level: number; module: string }

export type PythonNameToken = { name: string; offset: number }

/** An import statement's module path and imported names, for cursor-on-import navigation. */
export type PythonModuleReference = {
  level: number
  segments: PythonNameToken[]
  /** `from ... import` names before any `as`; empty for `import`. */
  importedNames: PythonNameToken[]
}

export type PythonBaseReference = { parts: string[]; offset: number }

export type PythonStatementFacts = {
  bindings: PythonBinding[]
  attributes: PythonAttributeAssignment[]
  globals: string[]
  nonlocals: string[]
  starImports: PythonStarImport[]
  moduleReferences: PythonModuleReference[]
}

export function emptyStatementFacts(): PythonStatementFacts {
  return {
    bindings: [],
    attributes: [],
    globals: [],
    nonlocals: [],
    starImports: [],
    moduleReferences: []
  }
}
