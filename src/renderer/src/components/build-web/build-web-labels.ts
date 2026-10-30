import {
  BUILD_WEB_UNASSIGNED,
  type BuildWebIssueProduct,
  type BuildWebIssueStatus,
  type BuildWebView
} from '../../../../shared/build-web-types'
import { translate } from '@/i18n/i18n'

// Labels are looked up when drawn, never cached at import: the language can change at runtime.

export function statusLabel(status: BuildWebIssueStatus): string {
  switch (status) {
    case 'unknown':
      return translate('buildWeb.status.unknown', 'Unknown')
    case 'todo':
      return translate('buildWeb.status.todo', 'To do')
    case 'planned':
      return translate('buildWeb.status.planned', 'Planned')
    case 'inprogress':
      return translate('buildWeb.status.inprogress', 'In progress')
    case 'paused':
      return translate('buildWeb.status.paused', 'Paused')
    case 'awaiting_response':
      return translate('buildWeb.status.awaitingResponse', 'Awaiting response')
    case 'deploying':
      return translate('buildWeb.status.deploying', 'Deploying')
    case 'build_failed':
      return translate('buildWeb.status.buildFailed', 'Build failed')
    case 'testing':
      return translate('buildWeb.status.testing', 'Testing')
    case 'testing_external':
      return translate('buildWeb.status.testingExternal', 'External testing')
    case 'done':
      return translate('buildWeb.status.done', 'Done')
    case 'wontfix':
      return translate('buildWeb.status.wontfix', "Won't fix")
  }
}

export function viewLabel(view: BuildWebView): string {
  switch (view) {
    case 'mine':
      return translate('buildWeb.view.mine', 'Mine')
    case 'ai':
      return translate('buildWeb.view.ai', 'For AI')
    case 'favorite':
      return translate('buildWeb.view.favorite', 'Favorites')
    case 'all':
      return translate('buildWeb.view.all', 'All')
  }
}

export function quickFilterLabel(filter: 'mine' | 'ai' | 'favorite' | 'jira' | 'archived'): string {
  if (filter === 'archived') {
    return translate('buildWeb.view.archived', 'Archive')
  }
  return filter === 'jira' ? translate('buildWeb.view.jira', 'Jira') : viewLabel(filter)
}

export function productLabel(product: BuildWebIssueProduct): string {
  if (product === 'unknown') {
    return translate('buildWeb.product.unknown', 'Unknown')
  }
  switch (product) {
    case 'storage':
      return 'Storage'
    case 'tools':
      return 'Tools'
    case 'cp':
      return 'Chat Platform'
    default:
      return product.toUpperCase()
  }
}

/** build-web's five priorities, highest first; an unknown number reads as itself. */
export const BUILD_WEB_PRIORITIES = [5, 4, 3, 2, 1] as const

export function priorityLabel(priority: number): string {
  switch (priority) {
    case 5:
      return translate('buildWeb.priority.highest', 'Highest')
    case 4:
      return translate('buildWeb.priority.high', 'High')
    case 3:
      return translate('buildWeb.priority.medium', 'Medium')
    case 2:
      return translate('buildWeb.priority.low', 'Low')
    case 1:
      return translate('buildWeb.priority.lowest', 'Lowest')
    default:
      return `P${priority}`
  }
}

/** A person as the table names them: the login, without the mail domain. */
export function loginOf(email: string): string {
  const at = email.indexOf('@')
  return at > 0 ? email.slice(0, at) : email
}

/** An assignee filter's value as the list names it: nobody, the viewer, or a login. */
export function assigneeFilterLabel(value: string, me: string | null): string {
  if (value === BUILD_WEB_UNASSIGNED) {
    return translate('buildWeb.filters.unassigned', 'Unassigned')
  }
  return me !== null && value === me.toLowerCase()
    ? translate('buildWeb.filters.assignedToMe', 'Mine')
    : loginOf(value)
}

export function typeLabel(type: string): string {
  switch (type) {
    case 'bug':
      return translate('buildWeb.type.bug', 'Bug')
    case 'improvement':
      return translate('buildWeb.type.improvement', 'Improvement')
    case 'chore':
      return translate('buildWeb.type.chore', 'Chore')
    default:
      return type
  }
}
