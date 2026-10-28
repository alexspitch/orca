import { useState } from 'react'
import { openExternalLink } from '../platform/external-link'
import { Pressable, Text, View } from 'react-native'
import { Moon, Pin, PinOff, RotateCcw, SquareArrowOutUpRight, Unlink } from 'lucide-react-native'
import { buildWorktreeNavigationActions } from '../agent-history/worktree-navigation-actions'
import { workspaceRouteHref } from '../navigation/workspace-execution-host'
import { useWorkspaceServer } from '../transport/workspace-server'
import { ActionSheetContent } from '../components/ActionSheetModal'
import { BottomDrawer } from '../components/BottomDrawer'
import { ConfirmModal } from '../components/ConfirmModal'
import { NewWorktreeModalController } from '../components/NewWorktreeModalController'
import { hostNewWorktreeSessionRoute } from '../host-new-worktree-session-route'
import { isWorktreePinned } from '../worktree/workspace-list-sections'
import { isTaskSessionAttention } from '../../../src/shared/sidebar-list/task-session-groups'
import { BUILD_WEB_SESSION_ACTION_LABELS } from '../../../src/shared/build-web-session-labels'
import { describeTaskAttention } from '../components/WorktreeTaskSession'
import type { ActionSheetAction } from '../components/ActionSheetModal'
import type { Worktree } from '../worktree/workspace-list-types'
import { useTaskAttentionActions } from './use-task-attention-actions'
import { hostScreenStyles as styles } from './host-screen-styles'
import { WorkspaceOptionsSheet } from './workspace-options-sheet'
import { WorkspaceDetailsSheet } from './workspace-details-sheet'
import type { HostScreenController } from './use-host-screen-controller'

const ACTION = BUILD_WEB_SESSION_ACTION_LABELS

// IS-147: a closed task's leftover leads with what it needs; «Remove anyway…» is its Delete.
function taskAttentionActions(
  target: Worktree,
  run: {
    open: (item: Worktree) => void
    confirmRemove: (item: Worktree) => void
    /** Asks first, as «Remove anyway» does: the worktree leaves the task for good. */
    confirmKeep: (item: Worktree) => void
    reopen: (item: Worktree) => void
  }
): ActionSheetAction[] {
  return [
    { label: ACTION.open.text, icon: SquareArrowOutUpRight, onPress: () => run.open(target) },
    {
      label: ACTION.removeAnyway.text,
      destructive: true,
      onPress: () => run.confirmRemove(target)
    },
    { label: ACTION.keep.text, icon: Unlink, onPress: () => run.confirmKeep(target) },
    // Why not for `replaced`: a newer session already works on the task.
    ...(target.buildWebSession?.reason === 'replaced'
      ? []
      : [{ label: ACTION.backToWork.text, icon: RotateCcw, onPress: () => run.reopen(target) }])
  ]
}

type ConfirmCopy = { title: string; message: string; confirm: string; destructive: boolean }

function deleteConfirmCopy(target: Worktree): ConfirmCopy {
  const name = `"${target.displayName || target.repo}" (${target.branch})`
  if (!isTaskSessionAttention(target)) {
    return {
      title: 'Delete Worktree',
      message: `Delete ${name}?`,
      confirm: 'Delete',
      destructive: true
    }
  }
  const reason = describeTaskAttention(target)
  return {
    title: 'Remove anyway',
    message: [`Remove ${name}?`, reason, ACTION.removeRule.text].filter(Boolean).join('\n\n'),
    confirm: 'Remove',
    destructive: true
  }
}

function keepConfirmCopy(target: Worktree): ConfirmCopy {
  const name = `"${target.displayName || target.repo}" (${target.branch})`
  const key = target.buildWebTask?.key ?? 'its task'
  return {
    title: 'Keep workspace',
    message: `Keep ${name} as it is and unlink it from ${key}? Orca will not remove it.`,
    confirm: 'Keep',
    destructive: false
  }
}

export function HostScreenOverlays({ controller }: { controller: HostScreenController }) {
  const {
    actions,
    catalog,
    client,
    connState,
    existingWorktreePaths,
    hostCapabilities,
    hostId,
    state
  } = controller
  const actionTarget = state.actionTarget
  const taskActions = useTaskAttentionActions({
    client,
    hostCapabilities,
    fetchWorktrees: catalog.fetchWorktrees,
    state
  })
  const [confirmKeep, setConfirmKeep] = useState<Worktree | null>(null)
  const closeActions = () => {
    setConfirmKeep(null)
    state.setActionTarget(null)
  }
  const confirmCopy = state.confirmDelete
    ? deleteConfirmCopy(state.confirmDelete)
    : confirmKeep
      ? keepConfirmCopy(confirmKeep)
      : null
  const cancelConfirm = () => {
    state.setConfirmDelete(null)
    setConfirmKeep(null)
  }
  const runConfirmed = () => {
    if (state.confirmDelete) {
      void actions.handleDeleteWorktree(state.confirmDelete)
    } else if (confirmKeep) {
      void taskActions.keepTaskSession(confirmKeep)
    }
    state.setConfirmDelete(null)
    closeActions()
  }
  // A server row's screens are offered by what that server supports, not the desktop.
  const actionServer = useWorkspaceServer({
    client,
    connState,
    desktopCapabilities: hostCapabilities,
    executionHost: actionTarget?.hostId
  })

  return (
    <>
      <WorkspaceOptionsSheet controller={controller} />

      {/* Confirm inline to avoid stacking native Modals. */}
      <BottomDrawer
        visible={actionTarget != null}
        onClose={() => {
          state.setConfirmDelete(null)
          closeActions()
        }}
      >
        {confirmCopy ? (
          <View>
            <View style={styles.confirmContent}>
              <Text style={styles.confirmTitle}>{confirmCopy.title}</Text>
              <Text style={styles.confirmMessage}>{confirmCopy.message}</Text>
            </View>
            <View style={styles.confirmButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmBtn,
                  styles.confirmBtnCancel,
                  pressed && styles.confirmBtnPressed
                ]}
                onPress={cancelConfirm}
              >
                <Text style={styles.confirmBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmBtn,
                  confirmCopy.destructive ? styles.confirmBtnDestructive : styles.confirmBtnPrimary,
                  pressed && styles.confirmBtnPressed
                ]}
                onPress={runConfirmed}
              >
                <Text
                  style={
                    confirmCopy.destructive
                      ? styles.confirmBtnDestructiveText
                      : styles.confirmBtnPrimaryText
                  }
                >
                  {confirmCopy.confirm}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <ActionSheetContent
            actions={
              actionTarget
                ? [
                    ...(isTaskSessionAttention(actionTarget)
                      ? taskAttentionActions(actionTarget, {
                          open: (item) => {
                            actions.openWorktreeSession(item)
                            closeActions()
                          },
                          confirmRemove: state.setConfirmDelete,
                          confirmKeep: setConfirmKeep,
                          reopen: (item) => {
                            void taskActions.reopenTask(item)
                            closeActions()
                          }
                        })
                      : []),
                    ...buildWorktreeNavigationActions({
                      hostId,
                      worktreeId: actionTarget.worktreeId,
                      worktreeName: actionTarget.displayName || actionTarget.repo,
                      executionHost: actionServer.routeHost,
                      hostCapabilities:
                        actionServer.server?.gates.hostCapabilities ?? hostCapabilities,
                      navigate: actions.navigateFromHostList,
                      onDone: () => state.setActionTarget(null)
                    }),
                    // Server sleep is not offered yet; the desktop would sleep its own id.
                    ...(actionServer.server
                      ? []
                      : [
                          {
                            label: 'Sleep',
                            icon: Moon,
                            onPress: () => {
                              actions.putWorktreeToSleep(actionTarget)
                              state.setActionTarget(null)
                            }
                          }
                        ]),
                    {
                      label: isWorktreePinned(actionTarget, state.pinnedIds) ? 'Unpin' : 'Pin',
                      icon: isWorktreePinned(actionTarget, state.pinnedIds) ? PinOff : Pin,
                      onPress: () => {
                        actions.togglePin(actionTarget)
                        state.setActionTarget(null)
                      }
                    },
                    ...(isTaskSessionAttention(actionTarget)
                      ? []
                      : [
                          {
                            label: 'Delete',
                            destructive: true,
                            onPress: () => state.setConfirmDelete(actionTarget)
                          }
                        ])
                  ]
                : []
            }
          >
            {actionTarget ? (
              <WorkspaceDetailsSheet
                row={actionTarget}
                onOpenLink={(url) => {
                  openExternalLink(url)
                  state.setActionTarget(null)
                }}
              />
            ) : null}
          </ActionSheetContent>
        )}
      </BottomDrawer>

      <ConfirmModal
        visible={state.confirmRemoveHost}
        title="Remove Host"
        message={`Remove "${state.hostName}"? You can re-pair later.`}
        confirmLabel="Remove"
        destructive
        onConfirm={() => void actions.handleRemoveHost()}
        onCancel={() => state.setConfirmRemoveHost(false)}
      />

      <NewWorktreeModalController
        visible={state.showNewWorktree}
        client={client}
        hostCapabilities={hostCapabilities}
        hostId={hostId}
        hostLabelById={state.hostLabelById}
        existingWorktreePaths={existingWorktreePaths}
        existingWorktrees={state.worktrees}
        // Use the platform opener: React Native Linking.openURL resolves without opening anything inside the shell’s WebView.
        openExternalUrl={openExternalLink}
        onCreated={(worktreeId, worktreeName, warning, executionHost) => {
          void catalog.fetchWorktrees({ allowDuringModal: true })
          actions.navigateFromHostList(
            workspaceRouteHref(
              hostNewWorktreeSessionRoute(hostId, worktreeId, worktreeName, warning),
              executionHost
            )
          )
        }}
        onClose={actions.closeNewWorktreeModal}
      />
    </>
  )
}
