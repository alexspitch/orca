import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { persistAgentLaunchTabOrder } from '@/lib/launch-agent-tab-order'
import { runDevServicesAction } from '@/lib/dev-services-client'
import { openUrlForWorkspace } from '@/lib/workspace-url-open'
import { resolvePortOpenInOrcaBrowser } from '@/lib/workspace-port-actions'
import type { DevServicesAvailability } from './use-dev-services-availability'
import type { DevServicesRunResponse } from '../../../../shared/dev-services-contract'

export type DevServicesActionRequest = { verb: string; args: readonly string[]; label: string }

export type DevServicesActions = {
  /** Keys of actions still running, so their buttons stay busy and cannot be clicked twice. */
  pending: ReadonlySet<string>
  run: (request: DevServicesActionRequest) => void
  openConsole: (command: string, title: string) => void
  openUrl: (url: string, event?: React.MouseEvent) => void
  copyText: (text: string) => void
}

export function devServicesActionKey(verb: string, args: readonly string[]): string {
  return [verb, ...args].join('\u0000')
}

function reportOutcome(label: string, response: DevServicesRunResponse): void {
  if (response.kind === 'done') {
    if (response.outcome.ok) {
      toast.success(response.outcome.message || label)
    } else {
      toast.error(label, {
        description: response.outcome.error?.message ?? response.outcome.message
      })
    }
    return
  }
  if (response.kind === 'unverifiable') {
    // Why a warning, not an error: the action may well have run; only its answer is missing.
    toast.warning(
      translate('devServices.actions.unverifiable', "Couldn't confirm: {{value0}}", {
        value0: label
      }),
      { description: response.message }
    )
    return
  }
  toast.error(label, { description: response.message })
}

export function useDevServicesActions(args: {
  availability: DevServicesAvailability | null
  commandHash: string | null
  onSettled: () => void
}): DevServicesActions {
  const { availability, commandHash, onSettled } = args
  // Why a ref beside the state: a second click lands before React re-renders with the first.
  const pendingRef = useRef(new Set<string>())
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set())

  const run = useCallback(
    ({ verb, args: actionArgs, label }: DevServicesActionRequest) => {
      if (!availability || !commandHash) {
        return
      }
      const key = devServicesActionKey(verb, actionArgs)
      if (pendingRef.current.has(key)) {
        return
      }
      pendingRef.current.add(key)
      setPending(new Set(pendingRef.current))
      runDevServicesAction(
        availability.target,
        availability.worktreeId,
        commandHash,
        verb,
        actionArgs
      )
        .then((response) => reportOutcome(label, response))
        .catch((error: unknown) =>
          reportOutcome(label, {
            kind: 'unverifiable',
            message: error instanceof Error ? error.message : String(error)
          })
        )
        .finally(() => {
          pendingRef.current.delete(key)
          setPending(new Set(pendingRef.current))
          onSettled()
        })
    },
    [availability, commandHash, onSettled]
  )

  const openConsole = useCallback(
    (command: string, title: string) => {
      if (!availability) {
        return
      }
      const store = useAppStore.getState()
      const tab = store.createTab(availability.worktreeId, undefined, undefined, {
        quickCommandLabel: title,
        pendingStartup: { command }
      })
      // Why: like a quick command — without these the new terminal can stay hidden behind an
      // editor, and the tab order falls back to terminals-first.
      store.setActiveTabType('terminal', availability.worktreeId)
      persistAgentLaunchTabOrder(availability.worktreeId, tab.id)
    },
    [availability]
  )

  const openUrl = useCallback(
    (url: string, event?: React.MouseEvent) => {
      if (!availability) {
        return
      }
      const state = useAppStore.getState()
      void openUrlForWorkspace({
        url,
        worktreeId: availability.worktreeId,
        runtimeTarget: availability.target,
        openInOrcaBrowser: resolvePortOpenInOrcaBrowser({
          settings: state.settings,
          event,
          isMac: navigator.userAgent.includes('Mac')
        }),
        createBrowserTab: state.createBrowserTab
      }).then((result) => {
        if (!result.ok) {
          toast.error(translate('devServices.actions.openFailed', 'Failed to open the address'), {
            description: result.reason
          })
        }
      })
    },
    [availability]
  )

  const copyText = useCallback((text: string) => {
    void window.api.ui.writeClipboardText(text)
  }, [])

  return { pending, run, openConsole, openUrl, copyText }
}
