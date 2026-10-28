import type { ReactNode } from 'react'
import { defineFixture } from '../../component-fixtures/component-fixture'
import { ConfirmationDialogProvider } from '../confirmation-dialog'
import WorktreeList from './WorktreeList'
import SidebarFilter from './SidebarFilter'
import { SidebarTaskAttentionCounter } from './SidebarTaskAttentionCounter'
import { taskSessionStore } from './worktree-list-task-sessions.fixture-data'

// IS-147: the workspaces list grouped by task, compared with the sidebar mockup.

const SIDEBAR_WIDTH = 320

function Sidebar({ height, children }: { height: number; children?: ReactNode }) {
  return (
    <ConfirmationDialogProvider>
      <div className="flex flex-col bg-worktree-sidebar text-foreground" style={{ height }}>
        {children}
        <WorktreeList scrollOffsetRef={{ current: 0 }} scrollAnchorRef={{ current: null }} />
      </div>
    </ConfirmationDialogProvider>
  )
}

/** Compact rows; the current workspace (IS-166) opens with its meta line. */
export const compactByTask = defineFixture({
  width: SIDEBAR_WIDTH,
  store: taskSessionStore(),
  render: () => <Sidebar height={720} />
})

/** Detailed cards with the session state on the right of the title row. */
export const detailedByTask = defineFixture({
  width: SIDEBAR_WIDTH,
  store: taskSessionStore({}, false),
  render: () => <Sidebar height={900} />
})

/** «Awaiting release» opened: its rows show the short timer and «soon» forms. */
export const compactReleaseOpened = defineFixture({
  width: SIDEBAR_WIDTH,
  store: taskSessionStore({ collapsedGroups: new Set(['task:release:expanded']) }),
  render: () => <Sidebar height={820} />
})

/** By project: attention rows keep their lane with a badge; the counter switches to By task. */
export const compactByProjectWithCounter = defineFixture({
  width: SIDEBAR_WIDTH,
  store: taskSessionStore({ groupBy: 'repo' }),
  render: () => (
    <Sidebar height={760}>
      <div className="flex h-10 shrink-0 items-center justify-end gap-1 px-2">
        <SidebarTaskAttentionCounter />
      </div>
    </Sidebar>
  )
})

/** The filter menu with the task-state switches. */
export const filterMenu = defineFixture({
  width: SIDEBAR_WIDTH,
  store: taskSessionStore({ hiddenSessionStates: ['progress'] }),
  render: () => (
    <div className="flex h-[520px] items-start justify-end bg-worktree-sidebar p-2">
      <SidebarFilter contentSide="bottom" />
    </div>
  ),
  interact: (frame) => {
    frame
      .querySelector<HTMLButtonElement>('button')
      ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
  }
})
