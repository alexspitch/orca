import { translate } from '@/i18n/i18n'
import type { BuildWebNotification } from '../../../../../shared/build-web-activity-types'

// How a bell row reads, in the menu and on a banner alike.

// Why dropped from the body: a build's log link, which the card's Build tab opens properly.
const BUILD_LOG_LINE =
  /^(https?:\/\/\S+\/job\/\S+\/\d+\/?|\/api\/(?:local-builds|agent-jobs)\/[\w-]+\/log)$/

export function notificationBody(body: string): string {
  return body
    .split('\n')
    .filter((line) => !BUILD_LOG_LINE.test(line.trim()))
    .join('\n')
    .trim()
}

export function notificationKindLabel(kind: string): string {
  switch (kind) {
    case 'build':
      return translate('buildWeb.activity.kindBuild', 'image build')
    case 'push':
      return translate('buildWeb.activity.kindPush', 'publish')
    case 'job':
      return translate('buildWeb.activity.kindJob', 'stand job')
    case 'train':
      return translate('buildWeb.activity.kindTrain', 'train')
    case 'runtime':
      return translate('buildWeb.activity.kindRuntime', 'console')
    case 'tests':
      return translate('buildWeb.activity.kindTests', 'nightly tests')
    case 'status':
      return translate('buildWeb.activity.kindStatus', 'status change')
    case 'assigned':
      return translate('buildWeb.activity.kindAssigned', 'assignment')
    case 'comment':
      return translate('buildWeb.activity.kindComment', 'comment')
    default:
      return kind
  }
}

/** A banner's second line: the task, then the first line of the row or what kind of row it is. */
export function notificationSummary(note: BuildWebNotification): string {
  const first = notificationBody(note.body).split('\n')[0]?.trim()
  return [note.issue_key, first || notificationKindLabel(note.kind)].filter(Boolean).join(' · ')
}
