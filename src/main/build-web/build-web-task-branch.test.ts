import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { prepareTaskWorkBranch, taskWorkBranchOf } from './build-web-task-branch'

// «Take to work» takes the console's branch for the task (IS-147): only the task's own name, as
// the repo has it — free at any commit, copied from the remote, refused when another worktree holds it.

const TASK = { issueId: 'i1', key: 'IS-344', consoleHost: 'https://bw.test' }
const BRANCH = 'IS-344-filtr-stolbca'

describe('taskWorkBranchOf', () => {
  it("takes only the task's own branch", () => {
    expect(taskWorkBranchOf({ ...TASK, workBranch: ` ${BRANCH} ` })).toBe(BRANCH)
    expect(taskWorkBranchOf(TASK)).toBeNull()
    expect(taskWorkBranchOf({ ...TASK, workBranch: 'master' })).toBeNull()
    expect(taskWorkBranchOf({ ...TASK, workBranch: 'IS-3440-other' })).toBeNull()
    expect(taskWorkBranchOf({ ...TASK, workBranch: 'IS-344-' })).toBeNull()
  })
})

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function repoWithRemote() {
  const root = await mkdtemp(path.join(tmpdir(), 'orca-bw-task-branch-'))
  roots.push(root)
  const repo = path.join(root, 'repo')
  const run = (cwd: string, args: string[]): string =>
    execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
  run(root, ['init', '-q', '-b', 'master', 'origin'])
  const origin = path.join(root, 'origin')
  run(origin, [
    '-c',
    'user.email=t@t',
    '-c',
    'user.name=t',
    'commit',
    '-q',
    '--allow-empty',
    '-m',
    'a'
  ])
  run(root, ['clone', '-q', origin, 'repo'])
  const git = (args: string[]): string => run(repo, args)
  const prepare = () =>
    prepareTaskWorkBranch({ repoPath: repo, branch: BRANCH, remote: 'origin', gitOptions: {} })
  return { root, repo, origin, run, git, prepare }
}

describe('prepareTaskWorkBranch', () => {
  it('makes a new branch when neither the repo nor the remote has it', async () => {
    const r = await repoWithRemote()
    expect(await r.prepare()).toMatchObject({ name: BRANCH, exists: false })
  })

  it('takes a free local branch at any commit', async () => {
    const r = await repoWithRemote()
    r.git(['branch', BRANCH])
    r.git(['switch', '-q', BRANCH])
    r.git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'b'])
    r.git(['switch', '-q', 'master'])
    expect(await r.prepare()).toMatchObject({ name: BRANCH, exists: true })
  })

  it('copies the remote branch, and drops the copy when the create fails', async () => {
    const r = await repoWithRemote()
    r.run(r.origin, ['branch', BRANCH])
    r.git(['fetch', '-q', 'origin'])
    const prepared = await r.prepare()
    expect(prepared).toMatchObject({ name: BRANCH, exists: true })
    expect(r.git(['branch', '--list', BRANCH])).toContain(BRANCH)
    await prepared?.rollback()
    expect(r.git(['branch', '--list', BRANCH])).toBe('')
  })

  it('refuses a branch another worktree holds, naming it', async () => {
    const r = await repoWithRemote()
    const holder = path.join(r.root, 'holder')
    r.git(['worktree', 'add', '-q', '-b', BRANCH, holder])
    await expect(r.prepare()).rejects.toThrow(/is checked out in .*holder/)
  })
})
