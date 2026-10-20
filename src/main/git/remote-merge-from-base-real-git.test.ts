import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { gitMergeFromBase } from './remote-rebase'

const roots: string[] = []

function git(cwd: string, args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=T', '-c', 'user.email=t@example.test', '-c', 'commit.gpgSign=false', ...args],
    { cwd, encoding: 'utf8', stdio: 'pipe' }
  ).trim()
}

/** A remote with `master`, a clone on `feature` made from it, and a second clone that moves master. */
async function setup(): Promise<{ work: string; other: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'orca-merge-base-'))
  roots.push(root)
  const remote = path.join(root, 'remote.git')
  execFileSync('git', ['init', '-q', '--bare', '-b', 'master', remote])
  const seed = path.join(root, 'seed')
  execFileSync('git', ['clone', '-q', remote, seed], { stdio: 'pipe' })
  git(seed, ['checkout', '-q', '-b', 'master'])
  await writeFile(path.join(seed, 'a.txt'), 'one\n')
  git(seed, ['add', '-A'])
  git(seed, ['commit', '-q', '-m', 'one'])
  git(seed, ['push', '-q', 'origin', 'master'])
  const work = path.join(root, 'work')
  execFileSync('git', ['clone', '-q', remote, work], { stdio: 'pipe' })
  git(work, ['checkout', '-q', '-b', 'feature', 'origin/master'])
  // The base moves on after the branch was made.
  await writeFile(path.join(seed, 'b.txt'), 'two\n')
  git(seed, ['add', '-A'])
  git(seed, ['commit', '-q', '-m', 'two'])
  git(seed, ['push', '-q', 'origin', 'master'])
  return { work, other: seed }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })))
})

describe('gitMergeFromBase (real Git)', () => {
  it('moves a branch with no commits of its own to the base, leaving no merge in history', async () => {
    const { work, other } = await setup()

    await gitMergeFromBase(work, 'origin/master')

    expect(git(work, ['rev-parse', 'HEAD'])).toBe(git(other, ['rev-parse', 'HEAD']))
    expect(git(work, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe('feature')
  })

  it('merges the base into a branch with commits of its own', async () => {
    const { work, other } = await setup()
    await writeFile(path.join(work, 'c.txt'), 'mine\n')
    git(work, ['add', '-A'])
    git(work, ['commit', '-q', '-m', 'mine'])

    await gitMergeFromBase(work, 'origin/master')

    const parents = git(work, ['rev-list', '--parents', '-n', '1', 'HEAD']).split(' ')
    expect(parents).toHaveLength(3)
    expect(parents).toContain(git(other, ['rev-parse', 'HEAD']))
    expect(git(work, ['log', '-1', '--format=%s'])).toBe(
      "Merge remote-tracking branch 'origin/master'"
    )
  })
})
