import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from './helpers/orca-app'
import { launchHeadlessPairedRuntimeHost } from './helpers/headless-paired-runtime-host'
import {
  CONSOLE_TOKEN,
  CONSOLE_URL,
  SESSION_POLL_MS,
  connectTaskHost,
  consoleSessionState,
  createTask,
  makeTaskRepository,
  moveTask,
  skillFinished,
  takeTaskToWork,
  taskSessionRow,
  taskSessionState
} from './helpers/build-web-task-session-fixture'

// IS-147: a «Take to work» worktree follows its task's session on a real serve host against a real
// console — waiting, removal of the empty one, attention and Keep for one that is not empty, the report
// of a manual delete, and a task returned during the console's pause.

test.skip(
  !CONSOLE_URL || !CONSOLE_TOKEN,
  'needs ORCA_E2E_BUILD_WEB_URL and ORCA_E2E_BUILD_WEB_TOKEN'
)
test.skip(process.platform === 'win32', 'the scratch repository is made with a POSIX shell')

test('a task worktree follows its session from work to removal', async () => {
  test.setTimeout(300_000)
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'orca-e2e-build-web-sessions-'))
  const host = await launchHeadlessPairedRuntimeHost({
    extraEnv: { ORCA_BUILD_WEB_SESSION_POLL_MS: String(SESSION_POLL_MS) },
    pinnedServePort: true
  })
  try {
    const work = makeTaskRepository(scratch)
    const repoId = await connectTaskHost(host, work)
    const poll = { timeout: 60_000, intervals: [SESSION_POLL_MS] }

    await test.step('done and empty: the worktree and its branch go, the session ends removed', async () => {
      const task = await createTask('E2E session lifecycle: done')
      const wt = await takeTaskToWork(host, repoId, task, 'e2e-tab-done')
      await expect.poll(() => taskSessionState(host, wt.worktreeId), poll).toBe('active')
      await moveTask(task.id, 'testing')
      await expect.poll(() => taskSessionState(host, wt.worktreeId), poll).toBe('waiting')
      await moveTask(task.id, 'done')
      await expect.poll(() => taskSessionState(host, wt.worktreeId), poll).toBe('closing')
      await skillFinished(task.id, 'e2e-tab-done')
      await expect.poll(() => taskSessionState(host, wt.worktreeId), poll).toBe('gone')
      await expect.poll(() => consoleSessionState(wt.sessionId), poll).toBe('removed')
      expect(existsSync(wt.path)).toBe(false)
      expect(execFileSync('git', ['branch', '--list', wt.branch], { cwd: work }).toString()).toBe(
        ''
      )
    })

    await test.step('closed but dirty: attention, and Keep unlinks it', async () => {
      const task = await createTask('E2E session lifecycle: dirty')
      const wt = await takeTaskToWork(host, repoId, task, 'e2e-tab-dirty')
      writeFileSync(path.join(wt.path, 'notes.txt'), 'work in progress\n')
      await moveTask(task.id, 'wontfix')
      await expect.poll(() => taskSessionState(host, wt.worktreeId), poll).toBe('attention:dirty')
      const kept = await host.client.call<{ ok: boolean }>('buildWeb.keepWorktreeSession', {
        worktreeId: wt.worktreeId
      })
      expect(kept.result.ok).toBe(true)
      await expect
        .poll(async () => (await taskSessionRow(host, wt.worktreeId))?.buildWebTask ?? null, poll)
        .toBeNull()
      await expect.poll(() => consoleSessionState(wt.sessionId), poll).toBe('kept')
      expect(existsSync(wt.path)).toBe(true)
    })

    await test.step('a manual delete still reaches the console', async () => {
      const task = await createTask('E2E session lifecycle: manual delete')
      const wt = await takeTaskToWork(host, repoId, task, 'e2e-tab-manual')
      await host.client.call('worktree.rm', { worktree: `id:${wt.worktreeId}`, force: true })
      await expect.poll(() => consoleSessionState(wt.sessionId), poll).toBe('removed')
    })

    await test.step('a removal report waits on disk through a host restart', async () => {
      const task = await createTask('E2E session lifecycle: restart')
      const wt = await takeTaskToWork(host, repoId, task, 'e2e-tab-restart')
      // Without a credential the report cannot go; it must outlive the process that queued it.
      await host.client.call('buildWeb.disconnect', {})
      await host.client.call('worktree.rm', { worktree: `id:${wt.worktreeId}`, force: true })
      await new Promise((resolve) => setTimeout(resolve, 3 * SESSION_POLL_MS))
      expect(await consoleSessionState(wt.sessionId)).toBe('active')
      await host.restartServeProcess()
      await connectTaskHost(host, work, { addRepo: false })
      await expect.poll(() => consoleSessionState(wt.sessionId), poll).toBe('removed')
    })

    await test.step('a task returned during the pause keeps its worktree', async () => {
      const task = await createTask('E2E session lifecycle: returned')
      const wt = await takeTaskToWork(host, repoId, task, 'e2e-tab-returned')
      await moveTask(task.id, 'done')
      await skillFinished(task.id, 'e2e-tab-returned')
      await moveTask(task.id, 'inprogress')
      await expect.poll(() => taskSessionState(host, wt.worktreeId), poll).toBe('active')
      // Past the console's shortened pause and several polls: nothing may be removed.
      await new Promise((resolve) => setTimeout(resolve, 12_000))
      expect(await taskSessionState(host, wt.worktreeId)).toBe('active')
      expect(existsSync(wt.path)).toBe(true)
    })
  } finally {
    await host.dispose()
    rmSync(scratch, { recursive: true, force: true })
  }
})
