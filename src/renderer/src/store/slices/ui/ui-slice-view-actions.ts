import type { UISlice, UISliceGet, UISliceSet } from './ui-slice-contract'
import { rewindHistoryIndexPastView } from '../worktree-nav-history'
import { createUiGitLogActions } from './ui-slice-git-log-actions'

/** Where a build-web page returns to: another build-web page carries over its own origin. */
function buildWebOrigin(state: UISlice): UISlice['previousViewBeforeBuildWeb'] {
  if (state.activeView === 'build-web') {
    return state.previousViewBeforeBuildWeb
  }
  if (state.activeView === 'build-web-images') {
    return state.previousViewBeforeBuildWebImages
  }
  if (state.activeView === 'git-log') {
    return state.previousViewBeforeGitLog
  }
  return state.activeView === 'build-web-trains'
    ? state.previousViewBeforeBuildWebTrains
    : state.activeView
}

export function createUiViewActions(set: UISliceSet, get: UISliceGet): Partial<UISlice> {
  return {
    ...createUiGitLogActions(set),
    openActivityPage: () => {
      set((state) => ({
        activeView: 'activity',
        previousViewBeforeActivity:
          state.activeView === 'activity' ? state.previousViewBeforeActivity : state.activeView
      }))
    },
    closeActivityPage: () =>
      set((state) => ({
        activeView: state.previousViewBeforeActivity
      })),
    selectedAutomationId: null,
    setSelectedAutomationId: (id) => set({ selectedAutomationId: id }),
    pendingAutomationRunNavigation: null,
    setPendingAutomationRunNavigation: (navigation) =>
      set({ pendingAutomationRunNavigation: navigation }),
    openAutomationsPage: () => {
      get().recordViewVisit('automations')
      set((state) => ({
        activeView: 'automations',
        previousViewBeforeAutomations:
          state.activeView === 'automations'
            ? state.previousViewBeforeAutomations
            : state.activeView
      }))
    },
    closeAutomationsPage: () =>
      set((state) => ({
        activeView: state.previousViewBeforeAutomations,
        worktreeNavHistoryIndex: rewindHistoryIndexPastView(state, 'automations')
      })),
    openSpacePage: () => {
      get().recordFeatureInteraction?.('workspace-cleanup')
      if (typeof window !== 'undefined' && window.api?.workspaceSpace?.openWindow) {
        void window.api.workspaceSpace.openWindow()
        return
      }
      set((state) => ({
        activeView: 'space',
        previousViewBeforeSpace:
          state.activeView === 'space' ? state.previousViewBeforeSpace : state.activeView
      }))
    },
    closeSpacePage: () =>
      set((state) => ({
        activeView: state.previousViewBeforeSpace
      })),
    openSkillsPage: () => {
      get().recordViewVisit('skills')
      set((state) => ({
        activeView: 'skills',
        previousViewBeforeSkills:
          state.activeView === 'skills' ? state.previousViewBeforeSkills : state.activeView
      }))
    },
    closeSkillsPage: () =>
      set((state) => ({
        activeView: state.previousViewBeforeSkills,
        worktreeNavHistoryIndex: rewindHistoryIndexPastView(state, 'skills')
      })),
    openSkillShare: (shareId) => {
      get().recordViewVisit('skills')
      set((state) => ({
        activeView: 'skills',
        previousViewBeforeSkills:
          state.activeView === 'skills' ? state.previousViewBeforeSkills : state.activeView,
        pendingSkillShareId: shareId
      }))
    },
    clearPendingSkillShare: () => set({ pendingSkillShareId: null }),
    openSkillsSharedLinks: () => {
      get().recordViewVisit('skills')
      set((state) => ({
        activeView: 'skills',
        previousViewBeforeSkills:
          state.activeView === 'skills' ? state.previousViewBeforeSkills : state.activeView,
        pendingSkillsSharedView: true
      }))
    },
    clearPendingSkillsSharedView: () => set({ pendingSkillsSharedView: false }),
    openArtifactsPage: () => {
      get().recordViewVisit('artifacts')
      set((state) => ({
        activeView: 'artifacts',
        previousViewBeforeArtifacts:
          state.activeView === 'artifacts' ? state.previousViewBeforeArtifacts : state.activeView
      }))
    },
    closeArtifactsPage: () =>
      set((state) => ({
        activeView: state.previousViewBeforeArtifacts,
        worktreeNavHistoryIndex: rewindHistoryIndexPastView(state, 'artifacts')
      })),
    // Why: no view-history entry — the page has its own modes, and back returns to where it was opened.
    // Moving between Issues and Images carries that origin over, so Escape never bounces between them.
    openBuildWebPage: () =>
      set((state) => ({
        activeView: 'build-web',
        previousViewBeforeBuildWeb: buildWebOrigin(state)
      })),
    closeBuildWebPage: () => set((state) => ({ activeView: state.previousViewBeforeBuildWeb })),
    openBuildWebImagesPage: () =>
      set((state) => ({
        activeView: 'build-web-images',
        previousViewBeforeBuildWebImages: buildWebOrigin(state)
      })),
    closeBuildWebImagesPage: () =>
      set((state) => ({ activeView: state.previousViewBeforeBuildWebImages })),
    openBuildWebTrainsPage: () =>
      set((state) => ({
        activeView: 'build-web-trains',
        previousViewBeforeBuildWebTrains: buildWebOrigin(state)
      })),
    closeBuildWebTrainsPage: () =>
      set((state) => ({ activeView: state.previousViewBeforeBuildWebTrains })),
    openMobilePage: () =>
      set((state) => ({
        activeView: 'mobile',
        previousViewBeforeMobile:
          state.activeView === 'mobile' ? state.previousViewBeforeMobile : state.activeView
      })),
    closeMobilePage: () =>
      set((state) => ({
        activeView: state.previousViewBeforeMobile
      })),
    setNewWorkspaceDraft: (draft) => set({ newWorkspaceDraft: draft }),
    clearNewWorkspaceDraft: () => set({ newWorkspaceDraft: null })
  }
}
