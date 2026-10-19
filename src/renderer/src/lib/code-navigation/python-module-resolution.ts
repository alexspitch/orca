import type { CodeNavigationFileAccess } from './code-navigation-types'

const MAX_ANCESTOR_ROOTS = 6
const MODULE_SEGMENT = /^[A-Za-z_\u0080-￿][\w\u0080-￿]*$/

function parentDirectory(relativePath: string): string {
  const slash = relativePath.lastIndexOf('/')
  return slash === -1 ? '' : relativePath.slice(0, slash)
}

function joinPath(directory: string, child: string): string {
  return directory === '' ? child : `${directory}/${child}`
}

function isInsideRoot(relativePath: string): boolean {
  return (
    !relativePath.startsWith('/') &&
    relativePath
      .split('/')
      .every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  )
}

function moduleFiles(root: string, modulePath: string): string[] {
  if (modulePath === '') {
    return [joinPath(root, '__init__.py'), joinPath(root, '__init__.pyi')]
  }
  const base = joinPath(root, modulePath)
  return [`${base}.py`, `${base}/__init__.py`, `${base}.pyi`, `${base}/__init__.pyi`]
}

/**
 * Ordered candidate files for `from <level dots><dottedName> import ...` / `import <dottedName>`.
 * Absolute imports try the workspace root, `src`, then the importing file's own and ancestor dirs.
 */
export function pythonModuleCandidates(
  level: number,
  dottedName: string,
  fromRelativePath: string | null
): string[] {
  const segments = dottedName === '' ? [] : dottedName.split('.')
  if (!segments.every((segment) => MODULE_SEGMENT.test(segment))) {
    return []
  }
  const modulePath = segments.join('/')
  let candidates: string[]
  if (level > 0) {
    if (fromRelativePath === null) {
      return []
    }
    let packageDirectory = parentDirectory(fromRelativePath)
    for (let step = 1; step < level; step++) {
      if (packageDirectory === '') {
        return []
      }
      packageDirectory = parentDirectory(packageDirectory)
    }
    candidates = moduleFiles(packageDirectory, modulePath)
  } else {
    if (modulePath === '') {
      return []
    }
    const roots = ['', 'src']
    let directory = fromRelativePath === null ? '' : parentDirectory(fromRelativePath)
    for (let count = 0; directory !== '' && count < MAX_ANCESTOR_ROOTS; count++) {
      roots.push(directory)
      directory = parentDirectory(directory)
    }
    candidates = [...new Set(roots)].flatMap((root) => moduleFiles(root, modulePath))
  }
  return [...new Set(candidates)].filter(isInsideRoot)
}

/** The first existing candidate module file, checked with one `existing` call. */
export async function resolvePythonModule(
  files: CodeNavigationFileAccess,
  level: number,
  dottedName: string,
  fromRelativePath: string | null,
  signal: AbortSignal
): Promise<string | null> {
  const candidates = pythonModuleCandidates(level, dottedName, fromRelativePath)
  if (candidates.length === 0) {
    return null
  }
  const existing = await files.existing(candidates, signal)
  signal.throwIfAborted()
  return candidates.find((candidate) => existing.has(candidate)) ?? null
}

export function isPythonPackageInit(relativePath: string): boolean {
  return /(?:^|\/)__init__\.pyi?$/.test(relativePath)
}
