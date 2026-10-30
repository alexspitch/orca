import {
  BUILD_WEB_UNASSIGNED,
  type BuildWebIssueProduct,
  type BuildWebIssueStatus,
  type BuildWebView
} from '../../../src/shared/build-web-types'

// The desktop's build-web-labels with its English defaults: mobile has no i18n.

export function statusLabel(status: BuildWebIssueStatus): string {
  switch (status) {
    case 'unknown':
      return 'Unknown'
    case 'todo':
      return 'To do'
    case 'planned':
      return 'Planned'
    case 'inprogress':
      return 'In progress'
    case 'paused':
      return 'Paused'
    case 'awaiting_response':
      return 'Awaiting response'
    case 'deploying':
      return 'Deploying'
    case 'build_failed':
      return 'Build failed'
    case 'testing':
      return 'Testing'
    case 'testing_external':
      return 'External testing'
    case 'done':
      return 'Done'
    case 'wontfix':
      return "Won't fix"
  }
}

export function viewLabel(view: BuildWebView): string {
  switch (view) {
    case 'mine':
      return 'Mine'
    case 'ai':
      return 'For AI'
    case 'favorite':
      return 'Favorites'
    case 'all':
      return 'All'
  }
}

export function quickFilterLabel(filter: 'mine' | 'ai' | 'favorite' | 'jira' | 'archived'): string {
  if (filter === 'archived') {
    return 'Archive'
  }
  return filter === 'jira' ? 'Jira' : viewLabel(filter)
}

export function productLabel(product: BuildWebIssueProduct): string {
  switch (product) {
    case 'unknown':
      return 'Unknown'
    case 'storage':
      return 'Storage'
    case 'tools':
      return 'Tools'
    case 'cp':
      return 'Chat Platform'
    case 'sa':
    case 'dc':
    case 'ap':
      return product.toUpperCase()
  }
}

/** build-web's five priorities, highest first; an unknown number reads as itself. */
export const BUILD_WEB_PRIORITIES = [5, 4, 3, 2, 1] as const

export function priorityLabel(priority: number): string {
  switch (priority) {
    case 5:
      return 'Highest'
    case 4:
      return 'High'
    case 3:
      return 'Medium'
    case 2:
      return 'Low'
    case 1:
      return 'Lowest'
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
    return 'Unassigned'
  }
  return me !== null && value === me.toLowerCase() ? 'Mine' : loginOf(value)
}

export function typeLabel(type: string): string {
  switch (type) {
    case 'bug':
      return 'Bug'
    case 'improvement':
      return 'Improvement'
    case 'chore':
      return 'Chore'
    default:
      return type
  }
}
