import type { BuildWebIssueEvent } from '../../../../../shared/build-web-types'
import type { ChipTone } from '../build-web-tones'

// IS-354: the card's «Activity», after build-web's issues/actions.ts: which filter a row is under,
// how its result reads, and who did it. Words come from the caller. No renderer aliases: mobile imports it.

/** The tab's filter: everything, and five groups of kinds. */
export const ISSUE_ACTIVITY_GROUPS = ['all', 'changes', 'talk', 'notify', 'build', 'guide'] as const
export type IssueActivityGroup = (typeof ISSUE_ACTIVITY_GROUPS)[number]

/** The group of a kind; a kind nobody named here, a newer one too, is a change. */
export function activityGroupOf(kind: string): Exclude<IssueActivityGroup, 'all'> {
  switch (kind) {
    case 'comment':
    case 'file':
    case 'subtask':
      return 'talk'
    case 'notify':
      return 'notify'
    case 'build':
      return 'build'
    case 'guide':
    case 'jira':
      return 'guide'
    default:
      return 'changes'
  }
}

export function activityRowsOf(
  events: readonly BuildWebIssueEvent[],
  group: IssueActivityGroup
): readonly BuildWebIssueEvent[] {
  return group === 'all' ? events : events.filter((e) => activityGroupOf(e.kind) === group)
}

export type ActivityResultWords = {
  delivered: string
  success: string
  notDelivered: string
  failed: string
  cancelled: string
}

/** The result cell: null for a change or a fact. A failure's reason is the hint. */
export function activityResultOf(
  e: Pick<BuildWebIssueEvent, 'kind' | 'result' | 'result_text'>,
  words: ActivityResultWords
): { label: string; tone: ChipTone; hint: string } | null {
  const message = e.kind === 'notify'
  switch (e.result) {
    case 'ok':
      return {
        label: e.result_text || (message ? words.delivered : words.success),
        tone: 'green',
        hint: ''
      }
    case 'failed':
      return {
        label: message ? words.notDelivered : words.failed,
        tone: 'red',
        hint: e.result_text
      }
    case 'cancelled':
      return { label: words.cancelled, tone: 'faint', hint: '' }
    default:
      return null
  }
}

export type ActivityActorWords = { train: (name: string) => string; watch: string; ai: string }

/** The console's own names for what is not a person; anybody else as `person` names them. */
export function activityActorOf(
  who: string,
  words: ActivityActorWords,
  person: (who: string) => string
): string {
  if (who.startsWith('train:')) {
    return words.train(who.slice('train:'.length))
  }
  if (who === 'watch') {
    return words.watch
  }
  if (who === 'ai') {
    return words.ai
  }
  return person(who) || '—'
}
