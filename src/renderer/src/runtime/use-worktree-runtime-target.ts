import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { getExecutionHostIdForWorktree } from '@/lib/worktree-runtime-owner'
import { getRuntimeTargetForFileOwner } from '@/lib/file-owner-runtime-target'
import { getActiveWorkspaceOwnerTarget } from '@/lib/resolved-worktree-execution-host'
import {
  runtimeRpcTargetForAuthorityKey,
  runtimeTargetEnvironmentId,
  runtimeTargetForOwnerEnvironment
} from './runtime-client-target'
import type { RuntimeClientTarget } from '../../../shared/runtime-client-target'
import {
  accountOwnerFor,
  wslHostDistroForTarget,
  type AccountOwner
} from '@/lib/wsl-host-account-owner'

/**
 * Runtime target that owns `worktreeId`, which is not always the globally
 * focused runtime — acting on the focused one scans the wrong host and reports
 * that workspace as having no ports. Direct-SSH owners return null.
 */
export function useWorktreeRuntimeTarget(
  worktreeId: string | null | undefined
): RuntimeClientTarget | null {
  const executionHostId = useAppStore((state) => getExecutionHostIdForWorktree(state, worktreeId))
  return useMemo(() => runtimeRpcTargetForAuthorityKey(executionHostId), [executionHostId])
}

/**
 * Transport to an open file's owner (see {@link getRuntimeTargetForFileOwner}), stable across
 * renders; `null` while rows disagree.
 */
export function useFileOwnerRuntimeTarget(
  worktreeId: string | null | undefined,
  runtimeEnvironmentId: string | null | undefined
): RuntimeClientTarget | null {
  // Why a string: a fresh target object per store write would re-render on every change.
  const ownerKey = useAppStore((state) => {
    const target = getRuntimeTargetForFileOwner(state, worktreeId, runtimeEnvironmentId)
    return target ? (target.kind === 'environment' ? target.environmentId : '') : null
  })
  return useMemo(
    () => (ownerKey === null ? null : runtimeTargetForOwnerEnvironment(ownerKey || null)),
    [ownerKey]
  )
}

/** {@link getActiveWorkspaceOwnerTarget}, else `fallback`; stable across renders. */
export function useActiveWorkspaceOwnerTarget(fallback: RuntimeClientTarget): RuntimeClientTarget {
  // Why a string: a fresh target object per store write would re-render on every change.
  const ownerKey = useAppStore((state) => {
    const target = getActiveWorkspaceOwnerTarget(state)
    return target ? (runtimeTargetEnvironmentId(target) ?? '') : null
  })
  const environmentId = ownerKey === null ? runtimeTargetEnvironmentId(fallback) : ownerKey || null
  return useMemo(() => runtimeTargetForOwnerEnvironment(environmentId), [environmentId])
}

/** Who owns the focused workspace's provider accounts (see {@link resolveAccountOwner}). */
export function useActiveAccountOwner(fallback: RuntimeClientTarget): AccountOwner {
  const ownerTarget = useActiveWorkspaceOwnerTarget(fallback)
  const wslHostDistro = useAppStore((state) =>
    wslHostDistroForTarget(ownerTarget, state.runtimeEnvironments)
  )
  return useMemo(() => accountOwnerFor(ownerTarget, wslHostDistro), [ownerTarget, wslHostDistro])
}

/**
 * {@link useActiveAccountOwner}, unless the status bar's usage host names this computer or a server
 * that is still paired; a forgotten server falls back to the focused workspace's owner.
 */
export function useUsageAccountOwner(fallback: RuntimeClientTarget): AccountOwner {
  const automatic = useActiveAccountOwner(fallback)
  const host = useAppStore((state) => state.statusBarUsageScope.host)
  const environmentId = host.kind === 'environment' ? host.environmentId : null
  // Why a string: a fresh lookup object per store write would re-render on every change.
  const pairedKey = useAppStore((state) => {
    const environment = environmentId
      ? state.runtimeEnvironments.find((candidate) => candidate.id === environmentId)
      : undefined
    if (!environment) {
      return null
    }
    return (
      wslHostDistroForTarget({ kind: 'environment', environmentId: environment.id }, [
        environment
      ]) ?? ''
    )
  })
  return useMemo(() => {
    if (host.kind === 'local') {
      return accountOwnerFor({ kind: 'local' }, null)
    }
    if (environmentId && pairedKey !== null) {
      return accountOwnerFor({ kind: 'environment', environmentId }, pairedKey || null)
    }
    return automatic
  }, [automatic, environmentId, host.kind, pairedKey])
}
