// @vitest-environment happy-dom

/** «By task» (IS-147): lanes by task state only, attention above Pinned, release collapsed until opened. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { GOLDEN_NOW } from './sidebar-list-golden-factories.test-fixture'
import type { GoldenView } from './sidebar-list-golden-store.test-fixture'
import {
  appendCapture,
  captureScenario,
  initialState
} from './sidebar-list-golden-suite.test-fixture'

const VIEWS: { label: string; overrides: Partial<AppState>; collapsedGroups?: string[] }[] = [
  { label: 'plain', overrides: {} },
  { label: 'release opened', overrides: {}, collapsedGroups: ['task:release:expanded'] },
  {
    label: 'host sections',
    overrides: { visibleWorkspaceHostIds: ['local', 'ssh:gpu-vm', 'runtime:env-1'] }
  },
  { label: 'session filter hides every lane it may', overrides: {} }
]

describe('sidebar row model goldens, groupBy=task', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(GOLDEN_NOW)
    useAppStore.setState(initialState, true)
  })

  afterEach(() => {
    cleanup()
    useAppStore.setState(initialState, true)
    vi.useRealTimers()
  })

  it('places each row in its first matching lane across sort, pins and host sections', async () => {
    const sections: string[] = []
    const seen = new Map<string, string>()
    for (const { label, overrides, collapsedGroups = [] } of VIEWS) {
      for (const sortBy of ['manual', 'recent'] as const) {
        for (const pinnedInGroups of [false, true]) {
          const view: GoldenView = {
            groupBy: 'task',
            sortBy,
            projectOrderBy: 'manual',
            pinnedInGroups,
            collapsedGroups: new Set(collapsedGroups)
          }
          const filter: Partial<AppState> = label.startsWith('session filter')
            ? { hiddenSessionStates: ['none', 'progress', 'release'] }
            : {}
          appendCapture(
            sections,
            seen,
            `${label} sort=${sortBy} pinnedInGroups=${pinnedInGroups}`,
            captureScenario(view, { ...overrides, ...filter })
          )
          useAppStore.setState(initialState, true)
        }
      }
    }
    await expect(`${sections.join('\n')}\n`).toMatchFileSnapshot(
      './__goldens__/sidebar-list/group-by-task.txt'
    )
  })
})
