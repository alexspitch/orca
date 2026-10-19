import type { CodeNavigationFileAccess } from './code-navigation-types'
import type { PythonBinding, PythonImportSource } from './python-binding-types'
import { findPythonClassMember, type PythonImportHop } from './python-definition-lookup'
import { isPythonPackageInit, resolvePythonModule } from './python-module-resolution'
import { getPythonSyntaxTree, type PythonSyntaxTree } from './python-syntax-tree'

export type PythonHopTarget =
  | { kind: 'module'; relativePath: string }
  | { kind: 'symbol'; relativePath: string; tree: PythonSyntaxTree; binding: PythonBinding }

const MAX_REEXPORT_DEPTH = 4
const MAX_BASE_CLASS_HOPS = 2

/** Follows imports across workspace files for one definition request. */
export class PythonImportResolver {
  private readonly visited = new Set<string>()

  constructor(
    private readonly files: CodeNavigationFileAccess,
    private readonly signal: AbortSignal
  ) {}

  resolveModule(level: number, module: string, fromPath: string | null): Promise<string | null> {
    return resolvePythonModule(this.files, level, module, fromPath, this.signal)
  }

  private async loadTree(relativePath: string): Promise<PythonSyntaxTree | null> {
    const text = await this.files.readText(relativePath, this.signal)
    this.signal.throwIfAborted()
    return text === null
      ? null
      : getPythonSyntaxTree(text, `file:${this.files.cacheScope}:${relativePath}`)
  }

  /** An import binding found in `fromPath`, then its attribute path. */
  async followHop(
    fromPath: string | null,
    hop: PythonImportHop,
    baseClassHops: number
  ): Promise<PythonHopTarget | null> {
    if (hop.viaBaseClass && baseClassHops >= MAX_BASE_CLASS_HOPS) {
      return null
    }
    const target = await this.importTarget(fromPath, hop.binding.importSource, 0)
    if (!target) {
      return null
    }
    return this.followPath(target, hop.path, hop.viaBaseClass ? baseClassHops + 1 : baseClassHops)
  }

  private async importTarget(
    fromPath: string | null,
    source: PythonImportSource | null,
    depth: number
  ): Promise<PythonHopTarget | null> {
    if (!source) {
      return null
    }
    if (source.kind === 'module') {
      const relativePath = await this.resolveModule(0, source.module, fromPath)
      return relativePath ? { kind: 'module', relativePath } : null
    }
    return this.importedName(fromPath, source.level, source.module, source.name, depth)
  }

  /** `from <module> import <name>`: a member of the module, else its submodule. */
  async importedName(
    fromPath: string | null,
    level: number,
    module: string,
    name: string,
    depth: number
  ): Promise<PythonHopTarget | null> {
    const modulePath = await this.resolveModule(level, module, fromPath)
    const member = modulePath ? await this.moduleMember(modulePath, name, depth + 1) : null
    if (member) {
      return member
    }
    const submodule = await this.resolveModule(level, module ? `${module}.${name}` : name, fromPath)
    return submodule ? { kind: 'module', relativePath: submodule } : null
  }

  /**
   * A top-level `name` of a module file: its own definition, a followed re-export, a star
   * import's member, a package submodule, and last the re-export line itself.
   */
  async moduleMember(
    relativePath: string,
    name: string,
    depth: number
  ): Promise<PythonHopTarget | null> {
    const key = `${relativePath}#${name}`
    if (depth > MAX_REEXPORT_DEPTH || this.visited.has(key)) {
      return null
    }
    this.visited.add(key)
    const tree = await this.loadTree(relativePath)
    if (!tree) {
      return null
    }
    let unresolvedImport: PythonHopTarget | null = null
    for (const binding of tree.module.bindings) {
      if (binding.name !== name || binding.kind === 'augmented') {
        continue
      }
      if (binding.kind !== 'import') {
        return { kind: 'symbol', relativePath, tree, binding }
      }
      const followed = await this.importTarget(relativePath, binding.importSource, depth)
      if (followed) {
        return followed
      }
      unresolvedImport ??= { kind: 'symbol', relativePath, tree, binding }
    }
    for (const star of tree.starImports) {
      const starPath = await this.resolveModule(star.level, star.module, relativePath)
      const found = starPath ? await this.moduleMember(starPath, name, depth + 1) : null
      if (found) {
        return found
      }
    }
    if (isPythonPackageInit(relativePath)) {
      const submodule = await this.resolveModule(1, name, relativePath)
      if (submodule) {
        return { kind: 'module', relativePath: submodule }
      }
    }
    return unresolvedImport
  }

  private async followPath(
    start: PythonHopTarget,
    path: readonly string[],
    baseClassHops: number
  ): Promise<PythonHopTarget | null> {
    let current = start
    for (let index = 0; index < path.length; index++) {
      const segment = path[index]
      if (current.kind === 'module') {
        const next = await this.moduleMember(current.relativePath, segment, 0)
        if (!next) {
          return null
        }
        current = next
        continue
      }
      const classScope =
        current.binding.kind === 'class'
          ? current.tree.definitionScopes.get(current.binding)
          : undefined
      const member = classScope ? findPythonClassMember(current.tree, classScope, segment) : null
      if (!member) {
        return null
      }
      if (member.kind === 'local') {
        current = { ...current, binding: member.binding }
        continue
      }
      const rest = path.slice(index + 1)
      for (const hop of member.hops) {
        const found = await this.followHop(
          current.relativePath,
          { ...hop, path: [...hop.path, ...rest] },
          baseClassHops
        )
        if (found) {
          return found
        }
      }
      return null
    }
    return current
  }
}
