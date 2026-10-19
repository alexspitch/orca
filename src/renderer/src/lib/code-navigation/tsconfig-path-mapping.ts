import { parse } from 'jsonc-parser'
import type { CodeNavigationFileAccess } from './code-navigation-types'

export type TsPathMapping = {
  /** Root-relative directory, or null when no config in the chain sets `baseUrl`. */
  baseUrl: string | null
  /** Targets are relative to `pathsBase`. */
  paths: { pattern: string; targets: string[] }[]
  /** Root-relative directory `paths` targets resolve against. */
  pathsBase: string
}

type PathEntries = TsPathMapping['paths']

/** `baseUrl` is false when it points outside the workspace root. */
type ConfigOptions = { baseUrl?: string | false; paths?: PathEntries; pathsDir?: string }

const CACHE_TTL_MS = 60_000
const MAX_MAPPING_ENTRIES = 64
const MAX_DIRECTORY_ENTRIES = 256
const MAX_EXTENDS_DEPTH = 3
const MAX_REFERENCES = 4
const CONFIG_NAMES = ['tsconfig.json', 'jsconfig.json']

class ExpiringCache<V> {
  private readonly entries = new Map<string, { value: V; expires: number }>()
  constructor(private readonly maxEntries: number) {}

  get(key: string): { value: V } | undefined {
    const entry = this.entries.get(key)
    if (entry && entry.expires > Date.now()) {
      return entry
    }
    this.entries.delete(key)
    return undefined
  }

  set(key: string, value: V): void {
    this.entries.delete(key)
    this.entries.set(key, { value, expires: Date.now() + CACHE_TTL_MS })
    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (oldest !== undefined) {
        this.entries.delete(oldest)
      }
    }
  }
}

const mappingCache = new ExpiringCache<TsPathMapping | null>(MAX_MAPPING_ENTRIES)
const nearestConfigCache = new ExpiringCache<string | null>(MAX_DIRECTORY_ENTRIES)

/** Directory of a root-relative POSIX path; '' for files at the root. */
export function workspaceParentDirectory(relativePath: string): string {
  const slash = relativePath.lastIndexOf('/')
  return slash === -1 ? '' : relativePath.slice(0, slash)
}

/** Joins `relative` onto a root-relative directory; null when absolute or escaping the root. */
export function resolveWorkspacePath(baseDirectory: string, relative: string): string | null {
  const normalized = relative.replace(/\\/g, '/')
  if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
    return null
  }
  const segments: string[] = []
  for (const segment of `${baseDirectory}/${normalized}`.split('/')) {
    if (segment === '..') {
      if (segments.pop() === undefined) {
        return null
      }
    } else if (segment !== '' && segment !== '.') {
      segments.push(segment)
    }
  }
  return segments.join('/')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toPathEntries(paths: Record<string, unknown>): PathEntries {
  const entries: PathEntries = []
  for (const [pattern, targets] of Object.entries(paths)) {
    if (Array.isArray(targets)) {
      const strings = targets.filter((target): target is string => typeof target === 'string')
      entries.push({ pattern, targets: strings.map((target) => target.replace(/\\/g, '/')) })
    }
  }
  return entries
}

/** Relative `extends`/`references` targets only; package-name extends need node_modules. */
function resolveConfigReference(
  configDir: string,
  reference: string,
  isDirectoryOk: boolean
): string | null {
  if (!/^\.\.?(?:[\\/]|$)/.test(reference)) {
    return null
  }
  const resolved = resolveWorkspacePath(configDir, reference)
  if (resolved === null) {
    return null
  }
  if (resolved.endsWith('.json')) {
    return resolved
  }
  return isDirectoryOk ? resolveWorkspacePath(resolved, 'tsconfig.json') : `${resolved}.json`
}

async function readConfig(
  files: CodeNavigationFileAccess,
  configPath: string,
  signal: AbortSignal,
  depth: number
): Promise<{ options: ConfigOptions; references: string[] } | null> {
  const text = await files.readText(configPath, signal)
  signal.throwIfAborted()
  if (text === null) {
    return null
  }
  const json: unknown = parse(text, [], { allowTrailingComma: true, disallowComments: false })
  if (!isRecord(json)) {
    return null
  }
  const configDir = workspaceParentDirectory(configPath)
  let options: ConfigOptions = {}
  const parents =
    typeof json.extends === 'string'
      ? [json.extends]
      : Array.isArray(json.extends)
        ? json.extends
        : []
  for (const parent of depth < MAX_EXTENDS_DEPTH ? parents : []) {
    const parentPath =
      typeof parent === 'string' ? resolveConfigReference(configDir, parent, false) : null
    const loaded =
      parentPath === null ? null : await readConfig(files, parentPath, signal, depth + 1)
    if (loaded) {
      options = { ...options, ...loaded.options }
    }
  }
  const compilerOptions = json.compilerOptions
  if (isRecord(compilerOptions)) {
    if (typeof compilerOptions.baseUrl === 'string') {
      options.baseUrl = resolveWorkspacePath(configDir, compilerOptions.baseUrl) ?? false
    }
    if (isRecord(compilerOptions.paths)) {
      options.paths = toPathEntries(compilerOptions.paths)
      options.pathsDir = configDir
    }
  }
  const references = Array.isArray(json.references) ? json.references : []
  const referencePaths = references.flatMap((reference) =>
    isRecord(reference) && typeof reference.path === 'string'
      ? (resolveConfigReference(configDir, reference.path, true) ?? [])
      : []
  )
  return { options, references: referencePaths }
}

function toMapping(options: ConfigOptions, configDir: string): TsPathMapping | null {
  if (options.baseUrl === false || (options.baseUrl === undefined && !options.paths?.length)) {
    return null
  }
  const baseUrl = options.baseUrl ?? null
  return {
    baseUrl,
    paths: options.paths ?? [],
    pathsBase: baseUrl ?? options.pathsDir ?? configDir
  }
}

async function loadMapping(
  files: CodeNavigationFileAccess,
  configPath: string,
  signal: AbortSignal
): Promise<TsPathMapping | null> {
  const config = await readConfig(files, configPath, signal, 0)
  if (!config) {
    return null
  }
  const own = toMapping(config.options, workspaceParentDirectory(configPath))
  if (own || config.options.baseUrl === false) {
    return own
  }
  // Why: solution-style roots (`files: []` + `references`) keep `paths` in a referenced config.
  for (const reference of config.references.slice(0, MAX_REFERENCES)) {
    const referenced = await readConfig(files, reference, signal, 0)
    const mapping = referenced && toMapping(referenced.options, workspaceParentDirectory(reference))
    if (mapping) {
      return mapping
    }
  }
  return null
}

async function findNearestConfig(
  files: CodeNavigationFileAccess,
  directory: string,
  signal: AbortSignal
): Promise<string | null> {
  const cached = nearestConfigCache.get(`${files.cacheScope}:${directory}`)
  if (cached) {
    return cached.value
  }
  const directories: string[] = []
  for (let dir = directory; ; dir = workspaceParentDirectory(dir)) {
    directories.push(dir)
    if (dir === '') {
      break
    }
  }
  const candidates = directories.flatMap((dir) =>
    CONFIG_NAMES.map((name) => (dir ? `${dir}/${name}` : name))
  )
  const existing = await files.existing(candidates, signal)
  signal.throwIfAborted()
  // Each ancestor's answer is the first existing config at or above it, so one probe caches all.
  let nearest: string | null = null
  for (let index = directories.length - 1; index >= 0; index--) {
    const own = CONFIG_NAMES.map((name) =>
      directories[index] ? `${directories[index]}/${name}` : name
    )
    nearest = own.find((candidate) => existing.has(candidate)) ?? nearest
    nearestConfigCache.set(`${files.cacheScope}:${directories[index]}`, nearest)
  }
  return nearest
}

/** `baseUrl`/`paths` from the nearest tsconfig.json or jsconfig.json above `fromRelativePath`. */
export async function loadTsPathMapping(
  files: CodeNavigationFileAccess,
  fromRelativePath: string,
  signal: AbortSignal
): Promise<TsPathMapping | null> {
  const configPath = await findNearestConfig(
    files,
    workspaceParentDirectory(fromRelativePath),
    signal
  )
  if (configPath === null) {
    return null
  }
  const key = `${files.cacheScope}:${configPath}`
  const cached = mappingCache.get(key)
  if (cached) {
    return cached.value
  }
  const mapping = await loadMapping(files, configPath, signal)
  mappingCache.set(key, mapping)
  return mapping
}
