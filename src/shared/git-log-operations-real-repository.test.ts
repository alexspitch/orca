import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runProcess } from '@orca/process-host'
import { resolveExecutableCommand } from './node-cli-command-resolution'
import { runGitLogOperation } from './git-log-operations'
import { listChangedPaths, listTreeAtRevision, parseNameStatus } from './git-log-commit-operations'
import type { GitLogOperation } from './git-log-operation-types'

const roots: string[] = []
const gitBinary = resolveExecutableCommand(process.env.ORCA_TEST_GIT_BINARY ?? 'git')

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function createFixture() {
  if (!gitBinary) {
    throw new Error('Git is required for the Git page operation regressions')
  }
  const root = await mkdtemp(join(tmpdir(), 'orca-log-ops-'))
  roots.push(root)
  const repo = join(root, 'repo')
  const remote = join(root, 'remote.git')
  const emptyConfig = join(root, 'empty-git-config')
  const emptyHooks = join(root, 'empty-hooks')
  await mkdir(repo)
  await writeFile(emptyConfig, '')
  await mkdir(emptyHooks)
  const fixtureEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_'))
  )
  // Executor contract: a non-zero exit rejects, as the runtime's git runner does.
  const git = async (args: string[], cwd = repo) => {
    const result = await runProcess({
      program: gitBinary,
      args,
      cwd,
      env: {
        ...fixtureEnv,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: emptyConfig,
        GIT_AUTHOR_NAME: 'Ops Fixture',
        GIT_AUTHOR_EMAIL: 'ops@example.test',
        GIT_COMMITTER_NAME: 'Ops Fixture',
        GIT_COMMITTER_EMAIL: 'ops@example.test',
        GIT_TERMINAL_PROMPT: '0'
      },
      timeoutMs: 20000,
      maxOutputBytes: 1024 * 1024
    })
    if (result.code !== 0 || result.timedOut || result.outputTruncated) {
      throw Object.assign(new Error(`git ${args.join(' ')} failed: ${result.stderr}`), {
        stderr: result.stderr
      })
    }
    return { stdout: result.stdout, stderr: result.stderr }
  }
  const write = (file: string, text: string, dir = repo) => writeFile(join(dir, file), text)
  const commit = async (message: string, cwd = repo) => {
    await git(['add', '-A'], cwd)
    await git(['commit', '--quiet', '-m', message], cwd)
    return (await git(['rev-parse', 'HEAD'], cwd)).stdout.trim()
  }
  await git(['init', '--quiet', '--bare', remote], root)
  await git(['init', '--quiet'])
  await git(['config', 'commit.gpgsign', 'false'])
  await git(['config', 'tag.gpgsign', 'false'])
  await git(['config', 'core.hooksPath', emptyHooks])
  await git(['checkout', '--quiet', '-b', 'main'])
  await write('a.txt', 'one\n')
  const root1 = await commit('root')
  await git(['remote', 'add', 'origin', remote])
  await git(['push', '--quiet', '-u', 'origin', 'main'])
  const run = (operation: GitLogOperation, cwd = repo) => runGitLogOperation(git, cwd, operation)
  const head = async (cwd = repo) => (await git(['rev-parse', 'HEAD'], cwd)).stdout.trim()
  const branch = async (cwd = repo) =>
    (
      await git(['symbolic-ref', '--quiet', '--short', 'HEAD'], cwd).catch(() => ({ stdout: '' }))
    ).stdout.trim()
  const clean = async () => (await git(['status', '--porcelain'])).stdout.trim() === ''
  return { root, repo, remote, git, write, commit, run, head, branch, clean, root1 }
}

describe('Git page branch operations', () => {
  it('creates a branch at a commit, with or without checking it out', async () => {
    const f = await createFixture()
    expect(
      await f.run({ kind: 'createBranch', name: 'topic', startPoint: f.root1, checkout: false })
    ).toEqual({ status: 'done' })
    expect(await f.branch()).toBe('main')
    expect(
      await f.run({ kind: 'createBranch', name: 'next', startPoint: 'main', checkout: true })
    ).toEqual({ status: 'done' })
    expect(await f.branch()).toBe('next')
    expect(
      await f.run({ kind: 'createBranch', name: 'topic', startPoint: 'main', checkout: false })
    ).toMatchObject({ status: 'failed' })
    expect(
      await f.run({ kind: 'createBranch', name: 'bad name', startPoint: 'main', checkout: false })
    ).toMatchObject({ status: 'failed' })
  })

  it('checks out a local branch, and names the worktree that already holds one', async () => {
    const f = await createFixture()
    await f.git(['branch', 'topic'])
    expect(await f.run({ kind: 'checkout', ref: { kind: 'local', name: 'topic' } })).toEqual({
      status: 'done'
    })
    expect(await f.branch()).toBe('topic')
    const other = join(f.root, 'other')
    await f.git(['worktree', 'add', '--quiet', '-b', 'held', other])
    const result = await f.run({ kind: 'checkout', ref: { kind: 'local', name: 'held' } })
    expect(result).toMatchObject({ status: 'branch-in-worktree', branch: 'held' })
    expect(result.status === 'branch-in-worktree' && result.worktreePath.endsWith('other')).toBe(
      true
    )
  })

  it('checks a remote branch out as a local branch that tracks it, and a tag detached', async () => {
    const f = await createFixture()
    await f.git(['checkout', '--quiet', '-b', 'shared'])
    await f.write('b.txt', 'b\n')
    await f.commit('shared work')
    await f.git(['push', '--quiet', 'origin', 'shared'])
    await f.git(['checkout', '--quiet', 'main'])
    await f.git(['branch', '-D', 'shared'])
    expect(
      await f.run({ kind: 'checkout', ref: { kind: 'remote', name: 'origin/shared' } })
    ).toEqual({ status: 'done' })
    expect(await f.branch()).toBe('shared')
    expect((await f.git(['config', 'branch.shared.remote'])).stdout.trim()).toBe('origin')
    await f.git(['tag', 'v1', f.root1])
    expect(await f.run({ kind: 'checkout', ref: { kind: 'tag', name: 'v1' } })).toEqual({
      status: 'done'
    })
    expect(await f.branch()).toBe('')
    expect(await f.head()).toBe(f.root1)
  })

  it('checks out a revision detached', async () => {
    const f = await createFixture()
    await f.write('a.txt', 'two\n')
    await f.commit('second')
    expect(await f.run({ kind: 'checkoutRevision', commit: f.root1 })).toEqual({ status: 'done' })
    expect(await f.head()).toBe(f.root1)
    expect(await f.branch()).toBe('')
  })

  it('renames, and deletes only after a second ask when commits would be lost', async () => {
    const f = await createFixture()
    await f.git(['branch', 'old'])
    expect(await f.run({ kind: 'renameBranch', from: 'old', to: 'new' })).toEqual({
      status: 'done'
    })
    expect((await f.git(['branch', '--list', 'new'])).stdout).toContain('new')
    await f.git(['checkout', '--quiet', '-b', 'unmerged'])
    await f.write('c.txt', 'c\n')
    await f.commit('unmerged work')
    await f.git(['checkout', '--quiet', 'main'])
    expect(await f.run({ kind: 'deleteBranch', name: 'new', force: false })).toEqual({
      status: 'done'
    })
    expect(await f.run({ kind: 'deleteBranch', name: 'unmerged', force: false })).toEqual({
      status: 'not-fully-merged',
      branch: 'unmerged'
    })
    expect(await f.run({ kind: 'deleteBranch', name: 'unmerged', force: true })).toEqual({
      status: 'done'
    })
  })
})

describe('Git page operations that stop on conflicts', () => {
  async function conflicting() {
    const f = await createFixture()
    await f.git(['checkout', '--quiet', '-b', 'theirs'])
    await f.write('a.txt', 'theirs\n')
    const theirs = await f.commit('theirs')
    await f.git(['checkout', '--quiet', 'main'])
    await f.write('a.txt', 'ours\n')
    await f.commit('ours')
    return { ...f, theirs }
  }

  it('merges cleanly, and aborts a conflicting merge leaving the worktree as it was', async () => {
    const f = await conflicting()
    const before = await f.head()
    expect(await f.run({ kind: 'merge', ref: 'theirs' })).toEqual({
      status: 'conflict-aborted',
      operation: 'merge',
      files: ['a.txt']
    })
    expect(await f.head()).toBe(before)
    expect(await f.clean()).toBe(true)
    await f.git(['checkout', '--quiet', '-b', 'side', f.root1])
    await f.write('d.txt', 'd\n')
    await f.commit('side')
    await f.git(['checkout', '--quiet', 'main'])
    expect(await f.run({ kind: 'merge', ref: 'side' })).toEqual({ status: 'done' })
  })

  it('aborts a conflicting rebase and a conflicting checkout-and-rebase', async () => {
    const f = await conflicting()
    const before = await f.head()
    expect(await f.run({ kind: 'rebase', onto: 'theirs' })).toMatchObject({
      status: 'conflict-aborted',
      operation: 'rebase'
    })
    expect(await f.head()).toBe(before)
    expect(await f.branch()).toBe('main')
    expect(await f.clean()).toBe(true)
    expect(
      await f.run({ kind: 'checkoutAndRebase', branch: 'theirs', onto: 'main' })
    ).toMatchObject({ status: 'conflict-aborted' })
    expect(await f.clean()).toBe(true)
    // Undone means back on the branch the user was on, not on the one the rebase checked out.
    expect(await f.branch()).toBe('main')
    expect(await f.head()).toBe(before)
  })

  it('never aborts a merge the user left half done', async () => {
    const f = await conflicting()
    await f.git(['merge', '--no-edit', 'theirs']).catch(() => undefined)
    await f.write('a.txt', 'resolved\n')
    await f.git(['add', 'a.txt'])
    expect(await f.run({ kind: 'cherryPick', commit: f.theirs })).toMatchObject({
      status: 'failed'
    })
    expect(await f.run({ kind: 'merge', ref: 'theirs' })).toMatchObject({ status: 'failed' })
    expect(await f.run({ kind: 'rebase', onto: 'theirs' })).toMatchObject({ status: 'failed' })
    expect((await f.git(['rev-parse', '--verify', 'MERGE_HEAD'])).stdout.trim()).toBe(f.theirs)
    expect(await readFile(join(f.repo, 'a.txt'), 'utf8')).toBe('resolved\n')
  })

  it('cherry-picks, aborts a conflicting pick, and says when the change is already there', async () => {
    const f = await conflicting()
    expect(await f.run({ kind: 'cherryPick', commit: f.theirs })).toEqual({
      status: 'conflict-aborted',
      operation: 'cherry-pick',
      files: ['a.txt']
    })
    expect(await f.clean()).toBe(true)
    await f.git(['checkout', '--quiet', '-b', 'extra', f.root1])
    await f.write('e.txt', 'e\n')
    const extra = await f.commit('extra')
    await f.git(['checkout', '--quiet', 'main'])
    expect(await f.run({ kind: 'cherryPick', commit: extra })).toEqual({ status: 'done' })
    expect(await f.run({ kind: 'cherryPick', commit: extra })).toMatchObject({ status: 'failed' })
    expect(await f.clean()).toBe(true)
  })

  it('cherry-picks a merge commit against its first parent', async () => {
    const f = await createFixture()
    await f.git(['checkout', '--quiet', '-b', 'feature'])
    await f.write('f.txt', 'f\n')
    await f.commit('feature')
    await f.git(['checkout', '--quiet', '-b', 'integration', 'main'])
    await f.write('g.txt', 'g\n')
    await f.commit('integration')
    await f.git(['merge', '--quiet', '--no-ff', '--no-edit', 'feature'])
    const mergeCommit = await f.head()
    await f.git(['checkout', '--quiet', 'main'])
    expect(await f.run({ kind: 'cherryPick', commit: mergeCommit })).toEqual({ status: 'done' })
    expect((await f.git(['ls-files'])).stdout).toContain('f.txt')
  })
})

describe('Git page tags, remotes and read helpers', () => {
  it('creates light and annotated tags at a commit', async () => {
    const f = await createFixture()
    expect(await f.run({ kind: 'createTag', name: 'v1', commit: f.root1 })).toEqual({
      status: 'done'
    })
    expect(
      await f.run({ kind: 'createTag', name: 'v2', commit: f.root1, message: 'Release 2' })
    ).toEqual({ status: 'done' })
    expect((await f.git(['cat-file', '-t', 'v2'])).stdout.trim()).toBe('tag')
    expect(await f.run({ kind: 'createTag', name: 'v1', commit: f.root1 })).toMatchObject({
      status: 'failed'
    })
  })

  it('pushes a new branch with an upstream, updates a branch nobody has out, and deletes it remotely', async () => {
    const f = await createFixture()
    await f.git(['branch', 'topic'])
    expect(await f.run({ kind: 'pushBranch', branch: 'topic' })).toEqual({ status: 'done' })
    expect((await f.git(['config', 'branch.topic.merge'])).stdout.trim()).toBe('refs/heads/topic')
    const clone = join(f.root, 'clone')
    await f.git(['clone', '--quiet', '--branch', 'topic', f.remote, clone], f.root)
    await f.write('h.txt', 'h\n', clone)
    const remoteTip = await f.commit('remote work', clone)
    await f.git(['push', '--quiet', 'origin', 'topic'], clone)
    expect(await f.run({ kind: 'updateBranch', branch: 'topic' })).toEqual({ status: 'done' })
    expect((await f.git(['rev-parse', 'topic'])).stdout.trim()).toBe(remoteTip)
    expect(await f.run({ kind: 'fetchAll' })).toEqual({ status: 'done' })
    expect(await f.run({ kind: 'deleteRemoteBranch', remote: 'origin', branch: 'topic' })).toEqual({
      status: 'done'
    })
    expect((await f.git(['ls-remote', '--heads', 'origin', 'topic'])).stdout.trim()).toBe('')
  })

  it('pushes a branch that tracks origin/main under its own name, never onto main', async () => {
    const f = await createFixture()
    const remoteTip = async (ref: string) =>
      (await f.git(['ls-remote', 'origin', ref])).stdout.split('\t')[0]?.trim() ?? ''
    const mainTip = await remoteTip('refs/heads/main')
    await f.git(['checkout', '--quiet', '--track', '-b', 'feat', 'origin/main'])
    await f.write('e.txt', 'e\n')
    const feat = await f.commit('feat work')
    await f.git(['checkout', '--quiet', 'main'])
    expect(await f.run({ kind: 'pushBranch', branch: 'feat' })).toEqual({ status: 'done' })
    expect(await remoteTip('refs/heads/main')).toBe(mainTip)
    expect(await remoteTip('refs/heads/feat')).toBe(feat)
  })

  it('fast-forwards the current branch, and sends a branch held elsewhere to its worktree', async () => {
    const f = await createFixture()
    const clone = join(f.root, 'main-clone')
    await f.git(['clone', '--quiet', '--branch', 'main', f.remote, clone], f.root)
    await f.write('c.txt', 'c\n', clone)
    const tip = await f.commit('remote main work', clone)
    await f.git(['push', '--quiet', 'origin', 'main'], clone)
    await f.git(['config', 'pull.rebase', 'true'])
    expect(await f.run({ kind: 'updateBranch', branch: 'main' })).toEqual({ status: 'done' })
    expect(await f.head()).toBe(tip)
    const other = join(f.root, 'held-worktree')
    await f.git(['worktree', 'add', '--quiet', '--track', '-b', 'held', other, 'origin/main'])
    expect(await f.run({ kind: 'updateBranch', branch: 'held' })).toMatchObject({
      status: 'branch-in-worktree',
      branch: 'held'
    })
  })

  it('keeps reading name-status after a status it doesn’t list', () => {
    expect(parseNameStatus('U\0Makefile\0M\0src/a.ts\0R100\0old.ts\0new.ts\0')).toEqual([
      { path: 'src/a.ts', status: 'modified' },
      { path: 'new.ts', oldPath: 'old.ts', status: 'renamed' }
    ])
  })

  it('lists a revision’s files and what changed against the working tree or another commit', async () => {
    const f = await createFixture()
    await f.write('b.txt', 'b\n')
    const second = await f.commit('second')
    expect((await listTreeAtRevision({ git: f.git, cwd: f.repo }, second)).paths).toEqual([
      'a.txt',
      'b.txt'
    ])
    await f.write('a.txt', 'changed\n')
    expect(await listChangedPaths({ git: f.git, cwd: f.repo }, second, null)).toEqual([
      { path: 'a.txt', status: 'modified' }
    ])
    expect(await listChangedPaths({ git: f.git, cwd: f.repo }, f.root1, second)).toEqual([
      { path: 'b.txt', status: 'added' }
    ])
  })

  it('refuses an option-like ref instead of running it', async () => {
    const f = await createFixture()
    expect(await f.run({ kind: 'merge', ref: '--abort' })).toMatchObject({ status: 'failed' })
    expect(await f.run({ kind: 'checkout', ref: { kind: 'local', name: '-b' } })).toMatchObject({
      status: 'failed'
    })
  })
})
