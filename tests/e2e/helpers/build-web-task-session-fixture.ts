import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { expect } from './orca-app'
import type { HeadlessPairedRuntimeHost } from './headless-paired-runtime-host'

// IS-147: a serve host's task worktrees against the isolated console of tools/build-web
// (`scripts/e2e-console.sh start`, E2E_CLEANUP_DELAY_MS=8000). The console is driven over HTTP the
// way the skill and the tester drive it; Orca only over its RPC.

export const CONSOLE_URL = process.env.ORCA_E2E_BUILD_WEB_URL ?? ''
export const CONSOLE_TOKEN = process.env.ORCA_E2E_BUILD_WEB_TOKEN ?? ''
export const SESSION_POLL_MS = 1_000

export type TaskSessionRow = {
  worktreeId: string
  path: string
  buildWebTask?: { issueId: string; key: string; branch: string; sessionId?: string }
  buildWebSession?: { state: string; reason?: string }
}

export type TaskWorktree = { worktreeId: string; path: string; branch: string; sessionId: string }

async function consoleCall<T>(method: string, apiPath: string, body?: unknown): Promise<T> {
  const response = await fetch(`${CONSOLE_URL}${apiPath}`, {
    method,
    headers: {
      authorization: `Bearer ${CONSOLE_TOKEN}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${method} ${apiPath}: ${response.status} ${text}`)
  }
  return JSON.parse(text) as T
}

export type ConsoleTask = { id: string; key: string; title: string }

export async function createTask(title: string): Promise<ConsoleTask> {
  const answer = await consoleCall<{ issue?: { id: string; key: string } }>(
    'POST',
    '/api/tms/issues',
    { product: 'dc', title, type: 'improvement' }
  )
  expect(answer.issue?.id ?? '').not.toBe('')
  return { id: answer.issue?.id ?? '', key: answer.issue?.key ?? '', title }
}

export const moveTask = (id: string, status: string) =>
  consoleCall('PATCH', `/api/tms/issues/${encodeURIComponent(id)}`, { status })

/** What the skill's last `session-clear` does: the console hears that the agent finished. */
export const skillFinished = (id: string, surfaceId: string) =>
  consoleCall(
    'DELETE',
    `/api/tms/issues/${encodeURIComponent(id)}/agent-session?surface_id=${encodeURIComponent(surfaceId)}`
  )

export async function consoleSessionState(sessionId: string): Promise<string | null> {
  const answer = await consoleCall<{ sessions: { id: string; state: string }[] }>(
    'GET',
    `/api/tms/agent-sessions?ids=${encodeURIComponent(sessionId)}`
  )
  return answer.sessions.find((s) => s.id === sessionId)?.state ?? null
}

/** A clone with an `origin` to measure «empty» against, on `master` like the monorepo. */
export function makeTaskRepository(root: string): string {
  const origin = path.join(root, 'origin.git')
  const work = path.join(root, 'work')
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim()
  execFileSync('git', ['init', '-q', '--bare', '-b', 'master', origin])
  execFileSync('git', ['clone', '-q', origin, work], { stdio: 'pipe' })
  git(work, 'config', 'user.email', 'e2e@orca.test')
  git(work, 'config', 'user.name', 'Orca E2E')
  git(work, 'checkout', '-q', '-b', 'master')
  writeFileSync(path.join(work, 'README.md'), '# e2e\n')
  git(work, 'add', 'README.md')
  git(work, 'commit', '-q', '-m', 'init')
  git(work, 'push', '-q', '-u', 'origin', 'master')
  return work
}

export async function connectTaskHost(
  host: HeadlessPairedRuntimeHost,
  work: string
): Promise<string> {
  const connected = await host.client.call<{ ok: boolean }>('buildWeb.connect', {
    baseUrl: CONSOLE_URL,
    token: CONSOLE_TOKEN
  })
  expect(connected.result.ok).toBe(true)
  const added = await host.client.call<{ repo: { id: string } }>('repo.add', {
    path: work,
    kind: 'git'
  })
  return added.result.repo.id
}

export async function taskSessionRow(
  host: HeadlessPairedRuntimeHost,
  worktreeId: string
): Promise<TaskSessionRow | null> {
  const ps = await host.client.call<{ worktrees: TaskSessionRow[] }>('worktree.ps', { limit: 500 })
  return ps.result.worktrees.find((row) => row.worktreeId === worktreeId) ?? null
}

/** `active`, `attention:dirty`, `-` (no state) or `gone`. */
export async function taskSessionState(
  host: HeadlessPairedRuntimeHost,
  worktreeId: string
): Promise<string> {
  const row = await taskSessionRow(host, worktreeId)
  if (!row) {
    return 'gone'
  }
  const session = row.buildWebSession
  return `${session?.state ?? '-'}${session?.reason ? `:${session.reason}` : ''}`
}

/** «Take to work» as the clients do it: a new worktree for the task, then its session. */
export async function takeTaskToWork(
  host: HeadlessPairedRuntimeHost,
  repoId: string,
  task: ConsoleTask,
  surfaceId: string
): Promise<TaskWorktree> {
  const name = task.key.toLowerCase().replace(/\./g, '-')
  const created = await host.client.call<{ worktree: { id: string; path: string } }>(
    'worktree.create',
    {
      repo: `id:${repoId}`,
      name,
      displayName: task.title,
      buildWebTask: { issueId: task.id, key: task.key, consoleHost: CONSOLE_URL }
    }
  )
  const worktreeId = created.result.worktree.id
  const stored = await host.client.call<{ ok: boolean }>('buildWeb.setAgentSession', {
    id: task.id,
    session: {
      surface_kind: 'terminal',
      surface_id: surfaceId,
      worktree_name: name,
      execution_host_id: '',
      agent: 'claude',
      started_at: new Date().toISOString()
    },
    worktreeId
  })
  expect(stored.result.ok).toBe(true)
  let linked: TaskSessionRow | null = null
  await expect
    .poll(async () => {
      linked = await taskSessionRow(host, worktreeId)
      return linked?.buildWebTask?.sessionId ?? ''
    })
    .not.toBe('')
  const row: TaskSessionRow | null = linked
  return {
    worktreeId,
    path: created.result.worktree.path,
    branch: row?.buildWebTask?.branch ?? '',
    sessionId: row?.buildWebTask?.sessionId ?? ''
  }
}
