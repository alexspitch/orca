import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import type { BaseRefSearchResult } from '../../../../src/shared/repo-types'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { searchBranches } from '../../tasks/smart-source-search-requests'
import { colors } from '../../theme/mobile-theme'
import type { RpcClient } from '../../transport/rpc-client'
import type { TakeToWorkRepo } from './build-web-take-to-work'
import { readDefaultBaseRef } from './build-web-new-worktree'
import {
  TakeToWorkChoice,
  TakeToWorkField,
  TakeToWorkInput,
  partStyles
} from './TakeToWorkFormParts'

export type NewWorktreeDraft = { repoId: string; name: string; baseBranch: string }

const SEARCH_DELAY_MS = 250

/** The branch a new worktree of the repo starts from: the project's own default, else git's. */
function useDefaultBaseRef(client: RpcClient, repo: TakeToWorkRepo | undefined) {
  const [resolved, setResolved] = useState<{ repoId: string; ref: string | null } | null>(null)
  useEffect(() => {
    if (!repo) {
      return
    }
    let stale = false
    void readDefaultBaseRef(client, repo).then((ref) => {
      if (!stale) {
        setResolved({ repoId: repo.id, ref })
      }
    })
    return () => {
      stale = true
    }
  }, [client, repo])
  return resolved && resolved.repoId === repo?.id ? resolved.ref : undefined
}

function useBranchSearch(client: RpcClient, repoId: string, query: string) {
  const [found, setFound] = useState<{ key: string; refs: BaseRefSearchResult[] } | null>(null)
  const needle = query.trim()
  const key = `${repoId}\n${needle}`
  useEffect(() => {
    if (!repoId || !needle) {
      return
    }
    let stale = false
    const timer = setTimeout(() => {
      void searchBranches(client, repoId, needle).then(
        (refs) => !stale && setFound({ key, refs }),
        () => !stale && setFound({ key, refs: [] })
      )
    }, SEARCH_DELAY_MS)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [client, key, needle, repoId])
  return needle ? (found?.key === key ? found.refs : null) : []
}

/** Where the task's own worktree goes: the repository, its name and the branch it starts from. */
export function TakeToWorkNewWorktree({
  client,
  repos,
  draft,
  onChange
}: {
  client: RpcClient
  repos: TakeToWorkRepo[]
  draft: NewWorktreeDraft
  onChange: (draft: NewWorktreeDraft) => void
}) {
  const repo = repos.find((r) => r.id === draft.repoId)
  const defaultBaseRef = useDefaultBaseRef(client, repo)
  const [query, setQuery] = useState('')
  const refs = useBranchSearch(client, draft.repoId, query)
  // Why: the base is always a named branch, never "whatever the default is" left blank.
  useEffect(() => {
    if (!draft.baseBranch && defaultBaseRef) {
      onChange({ ...draft, baseBranch: defaultBaseRef })
    }
  }, [defaultBaseRef, draft, onChange])

  return (
    <View style={partStyles.field}>
      <TakeToWorkField label="Repository">
        {repos.length === 0 ? (
          <Text style={partStyles.hint}>This host has no git repository.</Text>
        ) : (
          repos.map((r) => (
            <TakeToWorkChoice
              key={r.id}
              title={r.displayName}
              detail={r.path}
              selected={r.id === draft.repoId}
              // A repo's branches are its own: its default is picked again.
              onPress={() => {
                setQuery('')
                onChange({ ...draft, repoId: r.id, baseBranch: '' })
              }}
            />
          ))
        )}
      </TakeToWorkField>
      <TakeToWorkField label="Name">
        <TakeToWorkInput
          value={draft.name}
          onChangeText={(name) => onChange({ ...draft, name })}
          accessibilityLabel="Worktree name"
        />
      </TakeToWorkField>
      {draft.repoId ? (
        <TakeToWorkField label="Base branch">
          <Text style={partStyles.choiceTitle}>
            {draft.baseBranch ||
              (defaultBaseRef === undefined ? 'Reading the default…' : 'None picked')}
            {draft.baseBranch && draft.baseBranch === defaultBaseRef ? ' (default)' : ''}
          </Text>
          <TakeToWorkInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search branches"
            accessibilityLabel="Search branches"
          />
          {refs === null ? <LoadingSpinner size={14} color={colors.textMuted} /> : null}
          {refs?.map((ref) => (
            <TakeToWorkChoice
              key={ref.refName}
              title={ref.refName}
              selected={ref.refName === draft.baseBranch}
              onPress={() => {
                setQuery('')
                onChange({ ...draft, baseBranch: ref.refName })
              }}
            />
          ))}
          {refs?.length === 0 && query.trim() ? (
            <Text style={partStyles.hint}>No branch matches.</Text>
          ) : null}
        </TakeToWorkField>
      ) : null}
      {draft.repoId && !draft.baseBranch && defaultBaseRef === null ? (
        <Text style={partStyles.hint}>Pick the branch the worktree starts from.</Text>
      ) : null}
      <Text style={partStyles.hint}>
        Orca creates the worktree, then the session works in it (-no-worktree).
      </Text>
    </View>
  )
}
