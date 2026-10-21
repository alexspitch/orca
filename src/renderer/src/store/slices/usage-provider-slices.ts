import type { StateCreator } from 'zustand'
import type {
  ClaudeUsageRange,
  ClaudeUsageScope,
  ClaudeUsageSnapshot
} from '../../../../shared/claude-usage-types'
import type {
  CodexUsageRange,
  CodexUsageScope,
  CodexUsageSnapshot
} from '../../../../shared/codex-usage-types'
import type {
  OpenCodeUsageRange,
  OpenCodeUsageScope,
  OpenCodeUsageSnapshot
} from '../../../../shared/opencode-usage-types'
import type {
  MuseUsageRange,
  MuseUsageScope,
  MuseUsageSnapshot
} from '../../../../shared/muse-usage-types'
import type { AppState } from '../types'
import {
  createUsagePatch,
  readUsageData,
  type UsageData,
  type UsageProviderTypes,
  type UsageSnapshot
} from './usage-provider-data'
import { resolveUsageHostApi } from './usage-hosts/usage-host-api'
import { isSameUsageSource } from './usage-hosts/usage-host-types'
import {
  CLAUDE_USAGE_MERGE_OPS,
  CODEX_USAGE_MERGE_OPS,
  MUSE_USAGE_MERGE_OPS,
  OPENCODE_USAGE_MERGE_OPS
} from './usage-hosts/usage-provider-merge-ops'

type UsageApi<T extends UsageProviderTypes<string, string, UsageSnapshot>> = {
  getScanState: () => Promise<T['snapshot']['scanState']>
  setEnabled: (args: { enabled: boolean }) => Promise<T['snapshot']['scanState']>
  refresh: (args?: { force?: boolean }) => Promise<T['snapshot']['scanState']>
  getSnapshot: (args: {
    scope: T['scope']
    range: T['range']
    limit?: number
  }) => Promise<T['snapshot']>
}

type ProviderUsageSlice<
  Prefix extends string,
  Name extends string,
  T extends UsageProviderTypes<string, string, UsageSnapshot>
> = {
  [K in keyof UsageData<T> as `${Prefix}Usage${Capitalize<K & string>}`]: UsageData<T>[K]
} & Record<`set${Name}UsageEnabled`, (enabled: boolean) => Promise<void>> &
  Record<`set${Name}UsageScope`, (scope: T['scope']) => Promise<void>> &
  Record<`set${Name}UsageRange`, (range: T['range']) => Promise<void>> &
  Record<`fetch${Name}Usage`, (opts?: { forceRefresh?: boolean }) => Promise<void>> &
  Record<`enable${Name}Usage`, () => Promise<void>> &
  Record<`refresh${Name}Usage`, () => Promise<void>>

type UsageProviderConfig<
  Prefix extends string,
  Name extends string,
  T extends UsageProviderTypes<string, string, UsageSnapshot>
> = {
  prefix: Prefix
  name: Name
  initialScope: T['scope']
  initialRange: T['range']
  getApi: () => UsageApi<T>
  /** The API reading the usage source `state` picks (see usage-hosts/usage-host-api.ts). */
  resolveApi: (state: AppState, local: UsageApi<T>) => UsageApi<T>
  hasCachedData: (scanState: T['snapshot']['scanState']) => boolean
}

function createUsageProviderSlice<
  Prefix extends string,
  Name extends string,
  T extends UsageProviderTypes<string, string, UsageSnapshot>
>(
  config: UsageProviderConfig<Prefix, Name, T>
): StateCreator<AppState, [], [], ProviderUsageSlice<Prefix, Name, T>> {
  return (set, get) => {
    const update = (patch: Partial<UsageData<T>>): void =>
      set(createUsagePatch(config.prefix, patch))
    const read = (): UsageData<T> => readUsageData<T>(get(), config.prefix)

    const fetchUsage = async (opts?: { forceRefresh?: boolean }): Promise<void> => {
      try {
        const source = get().usageSource
        const api = config.resolveApi(get(), config.getApi())
        // Why: a fetch for the previous source must not land on the one now shown.
        const updateIfCurrent = (patch: Partial<UsageData<T>>): void => {
          if (isSameUsageSource(get().usageSource, source)) {
            update(patch)
          }
        }
        const scanState = (await api.getScanState()) as T['snapshot']['scanState'] | undefined
        // Desktop-only usage APIs resolve undefined in paired web clients.
        if (!scanState) {
          return
        }

        const current = read()
        // Why isScanning too: a source switch clears the data and shows loading until it answers.
        const preserveLoading =
          (opts?.forceRefresh === true || current.scanState?.isScanning === true) &&
          current.scanState?.enabled === true &&
          current.summary === null
        updateIfCurrent({
          scanState: preserveLoading
            ? {
                ...scanState,
                isScanning: true,
                lastScanCompletedAt: null,
                lastScanError: null
              }
            : scanState
        })
        if (!scanState.enabled) {
          return
        }

        const selection = read()
        const snapshot = await api.getSnapshot({
          scope: selection.scope,
          range: selection.range,
          limit: 10
        })
        if (
          snapshot.scanState.lastScanCompletedAt !== null ||
          config.hasCachedData(snapshot.scanState)
        ) {
          updateIfCurrent({
            ...snapshot,
            scanState:
              opts?.forceRefresh === true
                ? { ...snapshot.scanState, isScanning: true }
                : snapshot.scanState
          })
        } else {
          updateIfCurrent({ scanState: { ...scanState, isScanning: true, lastScanError: null } })
        }

        await api.refresh({ force: opts?.forceRefresh ?? false })
        const refreshedSelection = read()
        updateIfCurrent(
          await api.getSnapshot({
            scope: refreshedSelection.scope,
            range: refreshedSelection.range,
            limit: 10
          })
        )
      } catch (error) {
        console.error(`Failed to fetch ${config.name} usage:`, error)
      }
    }

    const setEnabled = async (enabled: boolean): Promise<void> => {
      try {
        const nextScanState = (await config.getApi().setEnabled({ enabled })) as
          | T['snapshot']['scanState']
          | undefined
        if (!nextScanState) {
          return
        }
        update({
          scanState: enabled
            ? {
                ...nextScanState,
                isScanning: true,
                lastScanCompletedAt: null,
                lastScanError: null
              }
            : nextScanState,
          summary: null,
          daily: [],
          modelBreakdown: [],
          projectBreakdown: [],
          recentSessions: []
        })
        if (enabled) {
          await fetchUsage({ forceRefresh: true })
        }
      } catch (error) {
        console.error(`Failed to update ${config.name} usage setting:`, error)
      }
    }

    const initialData: UsageData<T> = {
      scope: config.initialScope,
      range: config.initialRange,
      scanState: null,
      summary: null,
      daily: [],
      modelBreakdown: [],
      projectBreakdown: [],
      recentSessions: []
    }

    return {
      ...createUsagePatch(config.prefix, initialData),
      [`set${config.name}UsageEnabled`]: setEnabled,
      [`set${config.name}UsageScope`]: async (scope: T['scope']) => {
        update({ scope })
        await fetchUsage()
      },
      [`set${config.name}UsageRange`]: async (range: T['range']) => {
        update({ range })
        await fetchUsage()
      },
      [`fetch${config.name}Usage`]: fetchUsage,
      [`enable${config.name}Usage`]: () => setEnabled(true),
      [`refresh${config.name}Usage`]: () => fetchUsage({ forceRefresh: true })
    } as ProviderUsageSlice<Prefix, Name, T>
  }
}

type ClaudeUsageTypes = UsageProviderTypes<ClaudeUsageScope, ClaudeUsageRange, ClaudeUsageSnapshot>
type CodexUsageTypes = UsageProviderTypes<CodexUsageScope, CodexUsageRange, CodexUsageSnapshot>
type OpenCodeUsageTypes = UsageProviderTypes<
  OpenCodeUsageScope,
  OpenCodeUsageRange,
  OpenCodeUsageSnapshot
>

type MuseUsageTypes = UsageProviderTypes<MuseUsageScope, MuseUsageRange, MuseUsageSnapshot>

export type ClaudeUsageSlice = ProviderUsageSlice<'claude', 'Claude', ClaudeUsageTypes>
export type CodexUsageSlice = ProviderUsageSlice<'codex', 'Codex', CodexUsageTypes>
export type OpenCodeUsageSlice = ProviderUsageSlice<'openCode', 'OpenCode', OpenCodeUsageTypes>
export type MuseUsageSlice = ProviderUsageSlice<'muse', 'Muse', MuseUsageTypes>

export const createClaudeUsageSlice = createUsageProviderSlice<
  'claude',
  'Claude',
  ClaudeUsageTypes
>({
  prefix: 'claude',
  name: 'Claude',
  initialScope: 'orca',
  initialRange: '30d',
  getApi: () => window.api.claudeUsage,
  resolveApi: (state, local) =>
    resolveUsageHostApi(
      'claude',
      local,
      CLAUDE_USAGE_MERGE_OPS,
      state.usageSource,
      state.usageServers
    ),
  hasCachedData: (state) => state.hasAnyClaudeData
})

export const createCodexUsageSlice = createUsageProviderSlice<'codex', 'Codex', CodexUsageTypes>({
  prefix: 'codex',
  name: 'Codex',
  initialScope: 'orca',
  initialRange: '30d',
  getApi: () => window.api.codexUsage,
  resolveApi: (state, local) =>
    resolveUsageHostApi(
      'codex',
      local,
      CODEX_USAGE_MERGE_OPS,
      state.usageSource,
      state.usageServers
    ),
  hasCachedData: (state) => state.hasAnyCodexData
})

export const createOpenCodeUsageSlice = createUsageProviderSlice<
  'openCode',
  'OpenCode',
  OpenCodeUsageTypes
>({
  prefix: 'openCode',
  name: 'OpenCode',
  initialScope: 'orca',
  initialRange: '30d',
  getApi: () => window.api.openCodeUsage,
  resolveApi: (state, local) =>
    resolveUsageHostApi(
      'opencode',
      local,
      OPENCODE_USAGE_MERGE_OPS,
      state.usageSource,
      state.usageServers
    ),
  hasCachedData: (state) => state.hasAnyOpenCodeData
})

export const createMuseUsageSlice = createUsageProviderSlice<'muse', 'Muse', MuseUsageTypes>({
  prefix: 'muse',
  name: 'Muse',
  initialScope: 'orca',
  initialRange: '30d',
  getApi: () => window.api.museUsage,
  resolveApi: (state, local) =>
    resolveUsageHostApi('muse', local, MUSE_USAGE_MERGE_OPS, state.usageSource, state.usageServers),
  hasCachedData: (state) => state.hasAnyMuseData
})
