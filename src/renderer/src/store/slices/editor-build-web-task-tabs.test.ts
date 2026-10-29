import { describe, expect, it, vi } from 'vitest'
import { createEditorTabsStore } from './editor-slice-test-harness'
import { drawTabsFromMain } from './tabs-drawn-from-main.test-fixture'

vi.mock('@/runtime/runtime-rpc-client', async (importOriginal) =>
  (
    await import('@/runtime/layout-apply-test-transport.test-fixture')
  ).runtimeRpcClientWithLayoutApply(await importOriginal())
)
vi.mock('@/runtime/runtime-layout-client', async (importOriginal) =>
  (
    await import('@/runtime/layout-apply-test-transport.test-fixture')
  ).runtimeLayoutClientWithTestFrames(await importOriginal())
)

const TASK = { contextKey: 'local', issueId: 'issue-166', key: 'IS-166', title: 'Speed up search' }

describe('build-web task tabs', () => {
  // IS-147: a sidebar number opens its task in the current workspace; again, it focuses that tab.
  it('opens a task once per workspace and focuses its tab when opened again', async () => {
    const store = createEditorTabsStore()
    const main = await drawTabsFromMain(store)

    store.getState().openBuildWebTaskTab('wt-1', TASK)
    store.getState().openBuildWebTaskTab('wt-1', { ...TASK, issueId: 'issue-171', key: 'IS-171' })
    store.getState().openBuildWebTaskTab('wt-1', TASK)
    await main.settle()

    const taskFiles = store.getState().openFiles.filter((file) => file.mode === 'build-web-task')
    expect(taskFiles.map((file) => file.buildWebTask?.key)).toEqual(['IS-166', 'IS-171'])
    expect(store.getState().activeFileId).toBe('wt-1::build-web-task::issue-166')
    expect(
      store
        .getState()
        .unifiedTabsByWorktree['wt-1']?.filter((tab) => tab.entityId.includes('build-web-task'))
    ).toHaveLength(2)
    main.close()
  })
})
