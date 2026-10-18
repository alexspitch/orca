import type { GitHistoryGraphColorId, GitHistoryItemRef } from '../../../../shared/git-history'
import { translate } from '@/i18n/i18n'

// Why the system locale: WebStorm shows dates the way the OS does (18.10.2026 / 10/18/2026).
const DATE = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
})
const TIME = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit'
})

export function formatGitLogRowDate(timestamp: number | undefined): string {
  if (timestamp === undefined) {
    return ''
  }
  const date = new Date(timestamp)
  return `${DATE.format(date)}, ${TIME.format(date)}`
}

export function formatGitLogDetailsDate(timestamp: number | undefined): string {
  if (timestamp === undefined) {
    return ''
  }
  const date = new Date(timestamp)
  return translate('gitLog.details.dateAt', '{{value0}} at {{value1}}', {
    value0: DATE.format(date),
    value1: TIME.format(date)
  })
}

export type GitLogRefLabel = {
  key: string
  label: string
  title: string
  color?: GitHistoryGraphColorId
  isTag: boolean
}

/**
 * WebStorm's ref labels: a local branch and the remote branches of the same name on one commit
 * read as one label ("origin & main"); other refs keep their own.
 */
export function gitLogRefLabels(refs: readonly GitHistoryItemRef[] | undefined): GitLogRefLabel[] {
  if (!refs || refs.length === 0) {
    return []
  }
  const remotes = refs.filter((ref) => ref.category === 'remote branches')
  const merged = new Set<string>()
  const labels: GitLogRefLabel[] = []
  for (const local of refs.filter((ref) => ref.category === 'branches')) {
    const twins = remotes.filter(
      (remote) => remote.name.slice(remote.name.indexOf('/') + 1) === local.name
    )
    twins.forEach((twin) => merged.add(twin.id))
    const remoteNames = twins.map((twin) => twin.name.slice(0, twin.name.indexOf('/')))
    labels.push({
      key: local.id,
      label: [...remoteNames, local.name].join(' & '),
      title: [local.name, ...twins.map((twin) => twin.name)].join(', '),
      color: local.color ?? twins.find((twin) => twin.color)?.color,
      isTag: false
    })
  }
  for (const ref of refs) {
    if (ref.category === 'branches' || merged.has(ref.id)) {
      continue
    }
    labels.push({
      key: ref.id,
      label: ref.name,
      title: ref.name,
      color: ref.color,
      isTag: ref.category === 'tags'
    })
  }
  return labels
}
