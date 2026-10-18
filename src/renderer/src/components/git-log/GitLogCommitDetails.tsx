import React, { useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'
import type { GitHistoryItem } from '../../../../shared/git-history'
import { loadGitRefsContaining } from './git-log-client'
import { formatGitLogDetailsDate } from './git-log-format'

const CONTAINING_DELAY_MS = 300
const BRANCHES_SHOWN = 6

type Containing =
  | { status: 'loading' }
  | { status: 'ready'; refs: string[] }
  | { status: 'unavailable' }

function branchesLine(containing: Containing): string | null {
  if (containing.status === 'loading') {
    return translate('gitLog.details.branchesLoading', 'Looking up branches…')
  }
  if (containing.status === 'unavailable') {
    return null
  }
  const { refs } = containing
  if (refs.length === 0) {
    return translate('gitLog.details.noBranches', 'In no branches')
  }
  const shown = refs.slice(0, BRANCHES_SHOWN).join(', ')
  const rest = refs.length - BRANCHES_SHOWN
  const list =
    rest > 0
      ? translate('gitLog.details.branchesMore', '{{value0}} and {{value1}} more', {
          value0: shown,
          value1: rest
        })
      : shown
  return refs.length === 1
    ? translate('gitLog.details.inOneBranch', 'In 1 branch: {{value0}}', {
        value0: list
      })
    : translate('gitLog.details.inBranches', 'In {{value0}} branches: {{value1}}', {
        value0: refs.length,
        value1: list
      })
}

/** The selected commit's full message, author line and the branches that contain it. */
export function GitLogCommitDetails({
  item,
  context
}: {
  item: GitHistoryItem | null
  context: RuntimeGitContext
}): React.JSX.Element {
  const [containing, setContaining] = useState<Containing>({
    status: 'loading'
  })

  // Why keyed by id: a log reload hands out new objects for the same commit.
  const itemId = item?.id ?? null
  useEffect(() => {
    if (!itemId) {
      return
    }
    let stale = false
    setContaining({ status: 'loading' })
    // Why delayed: `for-each-ref --contains` takes seconds on big repos; arrow-key browsing skips it.
    const timer = window.setTimeout(() => {
      loadGitRefsContaining(context, itemId).then(
        (refs) =>
          !stale && setContaining(refs ? { status: 'ready', refs } : { status: 'unavailable' }),
        () => !stale && setContaining({ status: 'unavailable' })
      )
    }, CONTAINING_DELAY_MS)
    return () => {
      stale = true
      window.clearTimeout(timer)
    }
  }, [context, itemId])

  if (!item) {
    return (
      <div className="px-3.5 py-3 text-xs text-muted-foreground">
        {translate('gitLog.details.none', 'Select a commit to see its details')}
      </div>
    )
  }
  const body = item.message.split('\n').slice(1).join('\n').trim()
  const branches = branchesLine(containing)
  return (
    <div className="scrollbar-sleek min-h-0 flex-1 overflow-auto px-3.5 pt-2 pb-3.5 select-text">
      <div className="font-mono text-xs leading-relaxed font-semibold whitespace-pre-wrap">
        {item.subject}
      </div>
      {body ? (
        <div className="mt-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap">{body}</div>
      ) : null}
      <div className="mt-3 text-xs">
        <span className="font-mono">{item.displayId ?? item.id.slice(0, 8)}</span> {item.author}{' '}
        {item.authorEmail ? (
          <span className="text-muted-foreground">
            {translate('gitLog.details.email', '<{{value0}}>', { value0: item.authorEmail })}
          </span>
        ) : null}{' '}
        {translate('gitLog.details.on', 'on')} {formatGitLogDetailsDate(item.timestamp)}
      </div>
      {branches ? <div className="mt-1.5 text-xs text-muted-foreground">{branches}</div> : null}
    </div>
  )
}
