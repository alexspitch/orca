import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { isUncommittedBlameSha } from '../../shared/git-blame'
import { getFileBlame } from './blame'

const tempRoots: string[] = []

function git(repo: string, args: string[]): string {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: 'pipe' }).trim()
}

async function repoWith(commits: { message: string; author: string; text: string }[]) {
  const root = await mkdtemp(path.join(tmpdir(), 'orca-blame-'))
  tempRoots.push(root)
  execFileSync('git', ['init', '-q', root])
  git(root, ['config', 'user.email', 'test@example.com'])
  git(root, ['config', 'commit.gpgSign', 'false'])
  const shas: string[] = []
  for (const commit of commits) {
    await writeFile(path.join(root, 'app.ts'), commit.text)
    git(root, ['add', '-A'])
    git(root, ['-c', `user.name=${commit.author}`, 'commit', '-q', '-m', commit.message])
    shas.push(git(root, ['rev-parse', 'HEAD']))
  }
  return { root, shas }
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('getFileBlame (real Git)', () => {
  it('blames the editor text: committed lines by commit, a typed line as uncommitted', async () => {
    const { root, shas } = await repoWith([
      { message: 'first', author: 'Ivan', text: 'a\nb\nc\n' },
      { message: 'second', author: 'Alex', text: 'a\nB\nc\n' }
    ])

    const blame = await getFileBlame(root, 'app.ts', 'a\nB\nnew\nc\n')

    const shaOfLine = (line: number) =>
      blame.ranges.find((r) => line >= r.startLine && line < r.startLine + r.lineCount)?.sha
    expect(shaOfLine(1)).toBe(shas[0])
    expect(shaOfLine(2)).toBe(shas[1])
    expect(isUncommittedBlameSha(shaOfLine(3) ?? '')).toBe(true)
    expect(shaOfLine(4)).toBe(shas[0])
    expect(blame.commits[shas[1]]).toMatchObject({
      author: 'Alex',
      summary: 'second',
      path: 'app.ts',
      previous: { sha: shas[0], path: 'app.ts' }
    })
  })
})
