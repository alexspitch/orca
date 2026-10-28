import {
  linksByDist,
  type BuildWebDistChoice,
  type LinkedSide
} from '../../../../../../shared/build-web-dist-links'
import { pickedCells, type Cell } from './run-cells'

// IS-230.23, after build-web's image-links.ts `linksByDist`: a ticked row gives its own references
// and its pair's — a rhel row its redos twin, a twin its rhel row.

/** The row of the other distribution of the same image and branch: a twin and its rhel row. */
function pairOf(all: readonly Cell[], c: Cell): Cell | undefined {
  const dist = c.dist === 'rhel' ? 'redos' : c.dist === 'redos' ? 'rhel' : null
  const p = dist
    ? all.find((x) => x.image === c.image && x.branch === c.branch && x.dist === dist)
    : undefined
  if (!p) {
    return undefined
  }
  const [rhel, twin] = c.dist === 'rhel' ? [c, p] : [p, c]
  // A twin of an earlier build: the rhel row was built again and its own twin is still to come.
  return twin.twinOfNumber !== null && twin.twinOfNumber !== rhel.number ? undefined : p
}

const sideOf = (c: Cell): LinkedSide => ({
  dist: c.dist,
  refs: c.tags,
  pushed: c.pushed
})

/** The references of the ticked rows in the chosen distribution; `all` is the whole run, as a filter may hide a pair. */
export function runLinksByDist(
  visible: Cell[],
  all: readonly Cell[],
  picked: ReadonlySet<string>,
  choice: BuildWebDistChoice
): string[] {
  const picks = pickedCells(visible, picked).map((cell) => {
    const pair = pairOf(all, cell)
    return { own: sideOf(cell), pair: pair ? sideOf(pair) : null }
  })
  return linksByDist(picks, choice).map((l) => l.ref)
}
