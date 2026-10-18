import type { GitRefEntry, GitRefKind } from '../../../../shared/git-log-page-types'

export type GitLogBranchRow =
  | { kind: 'head'; key: 'head'; depth: 0; label: string; filterRef: 'HEAD' }
  | {
      kind: 'group'
      key: string
      depth: number
      label: string
      expanded: boolean
    }
  | {
      kind: 'branch'
      key: string
      depth: number
      label: string
      filterRef: string
      ref: GitRefEntry
      isCurrent: boolean
      isFavorite: boolean
    }

type Leaf = { label: string; ref: GitRefEntry }
type Dir = {
  key: string
  name: string
  dirs: Map<string, Dir>
  leaves: Leaf[]
}

export type GitLogBranchTreeOptions = {
  headLabel: string
  sectionLabels: Record<GitRefKind, string>
  query: string
  groupByDirectory: boolean
  /** Groups whose open/closed state the user flipped from the default. */
  toggled: ReadonlySet<string>
  /** Starred refs; main and master by default. */
  isFavorite?: (ref: GitRefEntry) => boolean
}

const FAVORITE_NAMES = new Set(['main', 'master'])
const SECTIONS: { kind: GitRefKind; key: string }[] = [
  { kind: 'local', key: 'local' },
  { kind: 'remote', key: 'remote' },
  { kind: 'tag', key: 'tags' }
]

/** Local branches start open; remotes and tags start closed, as there can be thousands. */
function openByDefault(key: string): boolean {
  return key === 'local' || key.startsWith('local/')
}

export function isGitLogGroupExpanded(key: string, toggled: ReadonlySet<string>): boolean {
  return openByDefault(key) !== toggled.has(key)
}

/** main and master, local or remote, as WebStorm stars them by default. */
export function isGitLogFavoriteRef(ref: GitRefEntry): boolean {
  const name = ref.shortName.slice(ref.shortName.lastIndexOf('/') + 1)
  return ref.kind !== 'tag' && FAVORITE_NAMES.has(name)
}

function buildSection(refs: readonly GitRefEntry[], key: string, grouped: boolean): Dir {
  const root: Dir = { key, name: '', dirs: new Map(), leaves: [] }
  for (const ref of refs) {
    const segments = grouped ? ref.shortName.split('/') : [ref.shortName]
    let dir = root
    for (const segment of segments.slice(0, -1)) {
      let next = dir.dirs.get(segment)
      if (!next) {
        next = {
          key: `${dir.key}/${segment}`,
          name: segment,
          dirs: new Map(),
          leaves: []
        }
        dir.dirs.set(segment, next)
      }
      dir = next
    }
    dir.leaves.push({ label: segments.at(-1) ?? ref.shortName, ref })
  }
  return root
}

// Favourites are split out after sorting, so names alone order each group.
function compareLeaves(a: Leaf, b: Leaf): number {
  return a.label.localeCompare(b.label)
}

function emitDir(
  dir: Dir,
  depth: number,
  options: GitLogBranchTreeOptions,
  rows: GitLogBranchRow[]
): boolean {
  const query = options.query.trim().toLowerCase()
  const leaves = [...dir.leaves]
    .filter((leaf) => !query || leaf.ref.shortName.toLowerCase().includes(query))
    .sort(compareLeaves)
  const favorite = options.isFavorite ?? isGitLogFavoriteRef
  const favorites = leaves.filter((leaf) => favorite(leaf.ref))
  const others = leaves.filter((leaf) => !favorite(leaf.ref))
  const emitLeaf = (leaf: Leaf) =>
    rows.push({
      kind: 'branch',
      key: leaf.ref.fullName,
      depth,
      label: leaf.label,
      // Why the full name: `release` may be both a branch and a tag, and git picks the tag.
      filterRef: leaf.ref.fullName,
      ref: leaf.ref,
      isCurrent: leaf.ref.kind === 'local' && leaf.ref.isHead,
      isFavorite: favorite(leaf.ref)
    })
  favorites.forEach(emitLeaf)
  let emitted = leaves.length > 0
  for (const child of [...dir.dirs.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    emitted = emitGroup(child, child.name, depth, options, rows) || emitted
  }
  others.forEach(emitLeaf)
  return emitted
}

function emitGroup(
  dir: Dir,
  label: string,
  depth: number,
  options: GitLogBranchTreeOptions,
  rows: GitLogBranchRow[]
): boolean {
  const searching = options.query.trim() !== ''
  const expanded = searching || isGitLogGroupExpanded(dir.key, options.toggled)
  const at = rows.length
  rows.push({ kind: 'group', key: dir.key, depth, label, expanded })
  if (!expanded) {
    return true
  }
  const hasChildren = emitDir(dir, depth + 1, options, rows)
  if (searching && !hasChildren) {
    rows.splice(at, 1)
    return false
  }
  return true
}

export function buildGitLogBranchRows(
  refs: readonly GitRefEntry[],
  options: GitLogBranchTreeOptions
): GitLogBranchRow[] {
  const rows: GitLogBranchRow[] = [
    {
      kind: 'head',
      key: 'head',
      depth: 0,
      label: options.headLabel,
      filterRef: 'HEAD'
    }
  ]
  for (const section of SECTIONS) {
    const sectionRefs = refs.filter((ref) => ref.kind === section.kind)
    if (sectionRefs.length === 0) {
      continue
    }
    const root = buildSection(sectionRefs, section.key, options.groupByDirectory)
    emitGroup(root, options.sectionLabels[section.kind], 0, options, rows)
  }
  return rows
}

/** Every group key, for Expand All / Collapse All. */
export function collectGitLogGroupKeys(
  refs: readonly GitRefEntry[],
  groupByDirectory: boolean
): string[] {
  const keys: string[] = []
  const visit = (dir: Dir) => {
    keys.push(dir.key)
    dir.dirs.forEach(visit)
  }
  for (const section of SECTIONS) {
    const sectionRefs = refs.filter((ref) => ref.kind === section.kind)
    if (sectionRefs.length > 0) {
      visit(buildSection(sectionRefs, section.key, groupByDirectory))
    }
  }
  return keys
}

/** The toggles that make every group open (or every group closed). */
export function gitLogToggledForAll(keys: readonly string[], expanded: boolean): Set<string> {
  return new Set(keys.filter((key) => openByDefault(key) !== expanded))
}
