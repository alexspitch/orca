import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { WorktreeMeta } from '../../shared/worktree/meta-types'
import { createPendingBranchDrops } from './build-web-pending-branch-drops'

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the store keeps a meta whole; only buildWebTask matters here.
const META = {
  buildWebTask: { issueId: 'i1', key: 'IS-1', consoleHost: 'https://bw.test', branch: 'IS-1-a' }
} as WorktreeMeta

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function dropsFile(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'orca-bw-drops-'))
  roots.push(root)
  return path.join(root, 'drops.json')
}

describe('createPendingBranchDrops', () => {
  it('keeps a deleted worktree across a restart until the watcher looked at it', async () => {
    const file = await dropsFile()
    createPendingBranchDrops(file).add('repo::/w/is-1', META)
    const restarted = createPendingBranchDrops(file)
    expect(restarted.list().map((d) => [d.worktreeId, d.meta.buildWebTask?.branch])).toEqual([
      ['repo::/w/is-1', 'IS-1-a']
    ])
    restarted.remove('repo::/w/is-1')
    expect(createPendingBranchDrops(file).list()).toEqual([])
  })

  it('forgets one older than a month', async () => {
    const file = await dropsFile()
    createPendingBranchDrops(file, () => 0).add('repo::/w/is-1', META)
    expect(createPendingBranchDrops(file, () => 31 * 24 * 60 * 60_000).list()).toEqual([])
  })
})
