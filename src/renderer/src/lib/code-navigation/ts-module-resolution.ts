import type { CodeNavigationFileAccess } from './code-navigation-types'
import {
  loadTsPathMapping,
  resolveWorkspacePath,
  workspaceParentDirectory,
  type TsPathMapping
} from './tsconfig-path-mapping'

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.d.ts', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']
const TS_COUNTERPARTS: Record<string, readonly string[]> = {
  '.js': ['.ts', '.tsx', '.d.ts'],
  '.jsx': ['.ts', '.tsx', '.d.ts'],
  '.mjs': ['.mts', '.d.mts'],
  '.cjs': ['.cts', '.d.cts']
}
const RESOLVED_EXTENSION = /\.(?:tsx?|mts|cts|json)$/
const OTHER_EXTENSION = /\.[A-Za-z0-9]+$/

function isRelativeSpecifier(specifier: string): boolean {
  return /^\.\.?(?:\/|$)/.test(specifier)
}

/** Files a base path may name, in TypeScript's priority order. */
function expandCandidates(base: string): string[] {
  const jsExtension = /\.(?:jsx?|mjs|cjs)$/.exec(base)?.[0]
  if (jsExtension) {
    const stem = base.slice(0, -jsExtension.length)
    return [...TS_COUNTERPARTS[jsExtension].map((extension) => stem + extension), base]
  }
  if (RESOLVED_EXTENSION.test(base)) {
    return [base]
  }
  const index = base ? `${base}/index` : 'index'
  const candidates = [
    ...(base ? SOURCE_EXTENSIONS.map((extension) => base + extension) : []),
    ...SOURCE_EXTENSIONS.map((extension) => index + extension)
  ]
  // Why: a non-code import (`./styles.css`, `./logo.svg`) should still open the file itself.
  if (OTHER_EXTENSION.test(base.slice(base.lastIndexOf('/') + 1))) {
    candidates.push(base)
  }
  return candidates
}

/** TypeScript's choice: an exact pattern, else the wildcard with the longest prefix. */
function matchPathPattern(
  paths: TsPathMapping['paths'],
  specifier: string
): { targets: string[]; capture: string } | null {
  const exact = paths.find((entry) => !entry.pattern.includes('*') && entry.pattern === specifier)
  if (exact) {
    return { targets: exact.targets, capture: '' }
  }
  let best: { targets: string[]; capture: string; prefixLength: number } | null = null
  for (const { pattern, targets } of paths) {
    const star = pattern.indexOf('*')
    if (star === -1 || pattern.includes('*', star + 1)) {
      continue
    }
    const prefix = pattern.slice(0, star)
    const suffix = pattern.slice(star + 1)
    const fits =
      specifier.length >= prefix.length + suffix.length &&
      specifier.startsWith(prefix) &&
      specifier.endsWith(suffix)
    if (fits && (!best || prefix.length > best.prefixLength)) {
      const capture = specifier.slice(prefix.length, specifier.length - suffix.length)
      best = { targets, capture, prefixLength: prefix.length }
    }
  }
  return best
}

function mappedBases(mapping: TsPathMapping, specifier: string): (string | null)[] {
  const bases: (string | null)[] = []
  const match = matchPathPattern(mapping.paths, specifier)
  for (const target of match?.targets ?? []) {
    bases.push(resolveWorkspacePath(mapping.pathsBase, target.replace('*', match?.capture ?? '')))
  }
  if (mapping.baseUrl !== null) {
    bases.push(resolveWorkspacePath(mapping.baseUrl, specifier))
  }
  return bases
}

/**
 * Root-relative file an import specifier names: relative paths, then tsconfig `paths` and
 * `baseUrl`. Bare packages resolve to null (node_modules is out of scope).
 */
export async function resolveTsModule(
  files: CodeNavigationFileAccess,
  specifier: string,
  fromRelativePath: string,
  signal: AbortSignal
): Promise<string | null> {
  let bases: (string | null)[]
  if (isRelativeSpecifier(specifier)) {
    bases = [resolveWorkspacePath(workspaceParentDirectory(fromRelativePath), specifier)]
  } else {
    const mapping = await loadTsPathMapping(files, fromRelativePath, signal)
    bases = mapping ? mappedBases(mapping, specifier) : []
  }
  const candidates = [
    ...new Set(bases.flatMap((base) => (base === null ? [] : expandCandidates(base))))
  ]
  if (candidates.length === 0) {
    return null
  }
  const existing = await files.existing(candidates, signal)
  signal.throwIfAborted()
  return candidates.find((candidate) => existing.has(candidate)) ?? null
}
