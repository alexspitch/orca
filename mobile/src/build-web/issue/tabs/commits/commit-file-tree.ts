import { compareFileNames } from '../../../../../../src/shared/file-name-sort'

// The desktop's tree (source-control-tree) is not reachable here: its `@/` imports name the
// desktop's src, which resolves to the phone's. Same order: folders first, chains joined.

export type CommitTreeRow =
  | { kind: 'folder'; key: string; name: string; depth: number; files: number }
  | { kind: 'file'; key: string; name: string; depth: number; index: number }

type Folder = {
  name: string
  path: string
  folders: Map<string, Folder>
  files: { name: string; index: number }[]
}

const folderOf = (name: string, path: string): Folder => ({
  name,
  path,
  folders: new Map(),
  files: []
})
const byName = (a: { name: string }, b: { name: string }) => compareFileNames(a.name, b.name)
const countOf = (folder: Folder): number =>
  folder.files.length + [...folder.folders.values()].reduce((n, f) => n + countOf(f), 0)

function treeOf(paths: readonly string[]): Folder {
  const root = folderOf('', '')
  paths.forEach((path, index) => {
    const parts = path.split('/').filter(Boolean)
    let folder = root
    for (const name of parts.slice(0, -1)) {
      let next = folder.folders.get(name)
      if (!next) {
        next = folderOf(name, folder.path ? `${folder.path}/${name}` : name)
        folder.folders.set(name, next)
      }
      folder = next
    }
    folder.files.push({ name: parts.at(-1) ?? path, index })
  })
  return root
}

/** The files as rows top to bottom; a collapsed folder's own rows are left out. */
export function commitTreeRows(
  paths: readonly string[],
  collapsed: ReadonlySet<string>
): CommitTreeRow[] {
  const rows: CommitTreeRow[] = []
  const visit = (folder: Folder, depth: number) => {
    for (const child of [...folder.folders.values()].sort(byName)) {
      let shown = child
      let name = child.name
      for (let only = soleFolderOf(shown); only; only = soleFolderOf(shown)) {
        shown = only
        name = `${name}/${only.name}`
      }
      rows.push({ kind: 'folder', key: shown.path, name, depth, files: countOf(shown) })
      if (!collapsed.has(shown.path)) {
        visit(shown, depth + 1)
      }
    }
    for (const file of [...folder.files].sort(byName)) {
      rows.push({ kind: 'file', key: `${file.index}`, name: file.name, depth, index: file.index })
    }
  }
  visit(treeOf(paths), 0)
  return rows
}

function soleFolderOf(folder: Folder): Folder | null {
  if (folder.files.length > 0 || folder.folders.size !== 1) {
    return null
  }
  return folder.folders.values().next().value ?? null
}

/** The file the tree shows first, opened before one is picked. */
export function firstFileIndexOf(rows: readonly CommitTreeRow[]): number | null {
  const first = rows.find((row) => row.kind === 'file')
  return first?.kind === 'file' ? first.index : null
}
