import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { WorktreeMeta } from '../../shared/worktree/meta-types'
import { durableWriteTempPath, writeFileDurableSync } from '../durable-file-write'
import { recordOf, textOf } from './build-web-response-fields'

// Task worktrees a person deleted whose branch the watcher has yet to look at (IS-147). On disk,
// written inside the removal, so a quit before the next look or a removal before the watcher
// started still drops the branch.

export type PendingBranchDrop = { worktreeId: string; meta: WorktreeMeta; at: number }

export type PendingBranchDrops = {
  /** Synchronous and durable: called from inside a removal. */
  add: (worktreeId: string, meta: WorktreeMeta) => void
  remove: (worktreeId: string) => void
  list: () => readonly PendingBranchDrop[]
}

const MAX_DROPS = 200
const MAX_AGE_MS = 30 * 24 * 60 * 60_000

function dropOf(value: unknown): PendingBranchDrop | null {
  const v = recordOf(value)
  const worktreeId = textOf(v?.worktreeId)
  const meta = recordOf(v?.meta)
  if (!v || !worktreeId || !meta?.buildWebTask || typeof v.at !== 'number') {
    return null
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: written by `add` from a WorktreeMeta; the watcher reads its buildWebTask, checked above.
  return { worktreeId, meta: meta as WorktreeMeta, at: v.at }
}

function readDrops(filePath: string, now: number): PendingBranchDrop[] {
  try {
    const raw = recordOf(JSON.parse(readFileSync(filePath, 'utf-8')))
    const drops = Array.isArray(raw?.drops) ? raw.drops : []
    return drops
      .map(dropOf)
      .filter((d): d is PendingBranchDrop => d !== null && now - d.at < MAX_AGE_MS)
  } catch {
    return []
  }
}

export function createPendingBranchDrops(
  filePath: string,
  now: () => number = Date.now
): PendingBranchDrops {
  let drops = readDrops(filePath, now())

  const persist = (): void => {
    try {
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileDurableSync(
        durableWriteTempPath(filePath),
        filePath,
        `${JSON.stringify({ version: 1, drops }, null, 2)}\n`
      )
    } catch (error) {
      console.warn('[build-web] could not save the branches to drop:', error)
    }
  }

  return {
    add: (worktreeId, meta) => {
      drops = [...drops.filter((d) => d.worktreeId !== worktreeId), { worktreeId, meta, at: now() }]
      drops = drops.slice(-MAX_DROPS)
      persist()
    },
    remove: (worktreeId) => {
      const kept = drops.filter((d) => d.worktreeId !== worktreeId)
      if (kept.length !== drops.length) {
        drops = kept
        persist()
      }
    },
    list: () => drops
  }
}
