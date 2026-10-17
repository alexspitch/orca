import { useCallback, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { useAppStore } from '@/store'
import { defaultScopeHost } from '@/lib/default-creation-host'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import { callBuildWeb } from './build-web-client'
import { issueQueryOf, useBuildWebStore } from './build-web-store'

const SEARCH_DEBOUNCE_MS = 300

/** The host that holds the build-web token for this page, and the key its answers are tagged with. */
export function useBuildWebTarget(): { target: RuntimeClientTarget; contextKey: string } {
  const settings = useAppStore((s) => s.settings)
  const environmentId = settings?.activeRuntimeEnvironmentId ?? null
  return useMemo(
    () => ({
      target: defaultScopeHost({ activeRuntimeEnvironmentId: environmentId }),
      contextKey: getProviderRuntimeContextKey({ activeRuntimeEnvironmentId: environmentId })
    }),
    [environmentId]
  )
}

/** Reads the connection status for the current host on mount and whenever the host changes. */
export function useBuildWebStatus(): { refreshStatus: () => Promise<void> } {
  const { target, contextKey } = useBuildWebTarget()
  const setStatus = useBuildWebStore((s) => s.setStatus)
  const setError = useBuildWebStore((s) => s.setError)
  const latest = useRef(contextKey)
  latest.current = contextKey
  const refreshStatus = useCallback(async () => {
    try {
      const status = await callBuildWeb(target, 'status')
      // Why: a reply from the host the page just left must not overwrite this host's state.
      if (latest.current === contextKey) {
        setStatus(contextKey, status)
      }
    } catch (error) {
      if (latest.current === contextKey) {
        setError(error instanceof Error ? error.message : String(error))
      }
    }
  }, [contextKey, setError, setStatus, target])
  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])
  return { refreshStatus }
}

/** Loads the list for the current filters; a reply to an older request is dropped. */
export function useBuildWebIssueList(): { reload: () => void; loadMore: () => void } {
  const { target, contextKey } = useBuildWebTarget()
  const connected = useBuildWebStore(
    (s) => s.status?.connected === true && s.contextKey === contextKey
  )
  const view = useBuildWebStore((s) => s.view)
  const query = useBuildWebStore((s) => s.query)
  const statusFilter = useBuildWebStore((s) => s.statusFilter)
  const product = useBuildWebStore((s) => s.product)
  const generation = useRef(0)

  const load = useCallback(async () => {
    const mine = ++generation.current
    const store = useBuildWebStore.getState()
    store.setLoading()
    try {
      const page = await callBuildWeb(
        target,
        'listIssues',
        issueQueryOf({ view, query, statusFilter, product })
      )
      if (mine === generation.current) {
        useBuildWebStore.getState().setIssues(page.issues, page.total)
      }
    } catch (error) {
      if (mine === generation.current) {
        useBuildWebStore.getState().setError(error instanceof Error ? error.message : String(error))
      }
    }
  }, [product, query, statusFilter, target, view])

  // Why: the same generation as `load`, so a filter change drops a page for the old filters.
  const loadMore = useCallback(async () => {
    const mine = generation.current
    const store = useBuildWebStore.getState()
    // Why not while loading: a reload replaces the rows this page's offset is counted from.
    if (store.loading || store.loadingMore || store.issues.length >= store.total) {
      return
    }
    store.setLoadingMore(true)
    try {
      const page = await callBuildWeb(target, 'listIssues', {
        ...issueQueryOf({ view, query, statusFilter, product }),
        offset: store.issues.length
      })
      if (mine === generation.current) {
        useBuildWebStore.getState().appendIssues(page.issues, page.total)
      }
    } catch (error) {
      if (mine === generation.current) {
        useBuildWebStore.getState().setLoadingMore(false)
        toast.error(error instanceof Error ? error.message : String(error))
      }
    }
  }, [product, query, statusFilter, target, view])

  useEffect(() => {
    if (!connected) {
      return
    }
    const timer = window.setTimeout(() => void load(), query ? SEARCH_DEBOUNCE_MS : 0)
    return () => window.clearTimeout(timer)
  }, [connected, load, query])

  return { reload: () => void load(), loadMore: () => void loadMore() }
}
