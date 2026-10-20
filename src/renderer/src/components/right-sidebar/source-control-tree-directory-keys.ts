type TreeRowLike = { type: string; key: string; depth: number; children?: readonly TreeRowLike[] }

/** Keys of every folder in `nodes` and below them. */
export function collectSourceControlTreeDirectoryKeys(nodes: readonly TreeRowLike[]): string[] {
  const keys: string[] = []
  const visit = (node: TreeRowLike): void => {
    if (node.type !== 'directory') {
      return
    }
    keys.push(node.key)
    node.children?.forEach(visit)
  }
  nodes.forEach(visit)
  return keys
}

/** Every folder of a section, from its visible rows: the top-level folders hold the rest. */
export const sectionTreeDirectoryKeys = (rows: readonly TreeRowLike[]): string[] =>
  collectSourceControlTreeDirectoryKeys(rows.filter((row) => row.depth === 0))
