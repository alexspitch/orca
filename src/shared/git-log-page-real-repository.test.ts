import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runProcess } from '@orca/process-host'
import { resolveExecutableCommand } from './node-cli-command-resolution'
import {
  listGitRefsContainingFromExecutor,
  listGitRefsFromExecutor,
  loadGitLogPageFromExecutor
} from './git-log-page'

const repositories: string[] = []
const gitBinary = resolveExecutableCommand(process.env.ORCA_TEST_GIT_BINARY ?? 'git')

afterEach(async () => {
  await Promise.all(
    repositories.splice(0).map((repo) => rm(repo, { recursive: true, force: true }))
  )
})

async function createRepository() {
  if (!gitBinary) {
    throw new Error('Git is required for the real log page regression')
  }
  const repo = await mkdtemp(join(tmpdir(), 'orca-log-page-'))
  repositories.push(repo)
  const emptyConfig = join(repo, 'empty-git-config')
  const emptyHooks = join(repo, 'empty-hooks')
  await writeFile(emptyConfig, '')
  await mkdir(emptyHooks)
  const fixtureEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_'))
  )
  const run = async (args: string[], date = '2000-01-04T00:00:00Z', author = 'Ada') => {
    const result = await runProcess({
      program: gitBinary,
      args,
      cwd: repo,
      env: {
        ...fixtureEnv,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: emptyConfig,
        GIT_AUTHOR_NAME: author,
        GIT_AUTHOR_DATE: date,
        GIT_COMMITTER_DATE: date
      },
      timeoutMs: 10000,
      maxOutputBytes: 1024 * 1024
    })
    if (result.code !== 0 || result.timedOut || result.outputTruncated) {
      throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
    }
    return { stdout: result.stdout }
  }
  await run(['init', '--quiet'])
  await run(['config', 'user.name', 'Log Fixture'])
  await run(['config', 'user.email', 'log-fixture@example.test'])
  await run(['config', 'commit.gpgsign', 'false'])
  await run(['config', 'core.hooksPath', emptyHooks])
  await run(['checkout', '--quiet', '-b', 'main'])
  await run(['commit', '--quiet', '--allow-empty', '-m', 'root'], '2000-01-01T00:00:00Z')
  await run(['tag', '-a', 'v1', '-m', 'v1'])
  await run(['checkout', '--quiet', '-b', 'feature'])
  await run(
    ['commit', '--quiet', '--allow-empty', '-m', 'feature fix'],
    '2000-01-02T00:00:00Z',
    'Bob'
  )
  await run(['checkout', '--quiet', 'main'])
  await run(['commit', '--quiet', '--allow-empty', '-m', 'main fix'], '2000-01-03T00:00:00Z')
  await run(['update-ref', 'refs/remotes/origin/main', 'main'])
  await run(['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main'])
  // Executor contract: a non-zero exit rejects, as the runtime's git runner does.
  const git = (args: string[]) => run(args)
  return { repo, git, run }
}

describe('git log page on a real repository', () => {
  it('logs every branch, not just HEAD', async () => {
    const { repo, git } = await createRepository()
    const page = await loadGitLogPageFromExecutor(git, repo)
    expect(page.items.map((item) => item.subject)).toEqual(['main fix', 'feature fix', 'root'])
    expect(page.currentRef).toMatchObject({
      name: 'main',
      category: 'branches'
    })
  })

  it('combines text and author filters', async () => {
    const { repo, git } = await createRepository()
    const page = await loadGitLogPageFromExecutor(git, repo, {
      text: 'FIX',
      author: 'bob'
    })
    expect(page.items.map((item) => item.subject)).toEqual(['feature fix'])
  })

  it('narrows to the requested refs', async () => {
    const { repo, git } = await createRepository()
    const page = await loadGitLogPageFromExecutor(git, repo, {
      scope: { kind: 'refs', refs: ['feature'] }
    })
    expect(page.items.map((item) => item.subject)).toEqual(['feature fix', 'root'])
  })

  it('logs the branch, not a tag of the same name, given its full name', async () => {
    const { repo, git, run } = await createRepository()
    await run(['tag', 'feature', 'v1^{commit}'])
    const page = await loadGitLogPageFromExecutor(git, repo, {
      scope: { kind: 'refs', refs: ['refs/heads/feature'] }
    })
    expect(page.items.map((item) => item.subject)).toEqual(['feature fix', 'root'])
  })

  it('includes commits only a tag reaches, and pages with skip', async () => {
    const { repo, git, run } = await createRepository()
    await run(['checkout', '--quiet', '-b', 'gone'])
    await run(['commit', '--quiet', '--allow-empty', '-m', 'tagged only'], '2000-01-05T00:00:00Z')
    await run(['tag', 'released'])
    await run(['checkout', '--quiet', 'main'])
    await run(['branch', '-D', 'gone'])
    const all = await loadGitLogPageFromExecutor(git, repo)
    expect(all.items.map((item) => item.subject)).toEqual([
      'tagged only',
      'main fix',
      'feature fix',
      'root'
    ])
    const second = await loadGitLogPageFromExecutor(git, repo, { limit: 2, skip: 2 })
    expect(second.items.map((item) => item.subject)).toEqual(['feature fix', 'root'])
    expect(second).toMatchObject({ hasMore: false, nextSkip: 4 })
  })

  it('finds a commit by hash only when the other filters keep it', async () => {
    const { repo, git } = await createRepository()
    const root = (await loadGitLogPageFromExecutor(git, repo)).items.at(-1)!
    const prefix = root.id.slice(0, 8)
    const byHash = await loadGitLogPageFromExecutor(git, repo, { text: prefix })
    expect(byHash.items.map((item) => item.id)).toEqual([root.id])
    const byHashAndBob = await loadGitLogPageFromExecutor(git, repo, {
      text: prefix,
      author: 'Bob'
    })
    expect(byHashAndBob.items).toEqual([])
  })

  it('lists refs with peeled tags and without the remote HEAD', async () => {
    const { repo, git } = await createRepository()
    const { refs, userName } = await listGitRefsFromExecutor(git, repo)
    expect(refs.map((ref) => `${ref.kind}:${ref.shortName}`)).toEqual([
      'local:feature',
      'local:main',
      'remote:origin/main',
      'tag:v1'
    ])
    const root = (await loadGitLogPageFromExecutor(git, repo)).items.at(-1)
    expect(refs.find((ref) => ref.kind === 'tag')?.oid).toBe(root?.id)
    expect(refs.find((ref) => ref.shortName === 'main')?.isHead).toBe(true)
    expect(userName).toBe('Log Fixture')
  })

  it('lists the refs that contain a commit, HEAD first', async () => {
    const { repo, git } = await createRepository()
    const items = (await loadGitLogPageFromExecutor(git, repo)).items
    const featureCommit = items.find((item) => item.subject === 'feature fix')
    const rootCommit = items.find((item) => item.subject === 'root')
    expect((await listGitRefsContainingFromExecutor(git, repo, featureCommit!.id)).refs).toEqual([
      'feature'
    ])
    expect((await listGitRefsContainingFromExecutor(git, repo, rootCommit!.id)).refs).toEqual([
      'HEAD',
      'feature',
      'main',
      'origin/main'
    ])
  })
})
