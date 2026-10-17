import {
  BUILD_WEB_STATUSES,
  type BuildWebAgentSession,
  type BuildWebComment,
  type BuildWebIssueDetail,
  type BuildWebIssueRow,
  type BuildWebIssueProduct,
  type BuildWebIssueStatus,
  type BuildWebProduct
} from '../../shared/build-web-types'
import { numberOf, recordOf, textOf, textOrNull, textsOf } from './build-web-response-fields'

const PRODUCTS: readonly BuildWebProduct[] = ['sa', 'dc', 'ap', 'storage', 'tools']
const SURFACES: readonly BuildWebAgentSession['surface_kind'][] = [
  'terminal',
  'structured',
  'unknown'
]

function productOf(value: unknown): BuildWebIssueProduct {
  return PRODUCTS.find((p) => p === value) ?? 'unknown'
}

function statusOf(value: unknown): BuildWebIssueStatus {
  return BUILD_WEB_STATUSES.find((s) => s === value) ?? 'unknown'
}

function agentSessionOf(value: unknown): BuildWebAgentSession | null {
  const v = recordOf(value)
  const kind = SURFACES.find((k) => k === v?.surface_kind)
  if (!v || !kind) {
    return null
  }
  return {
    surface_kind: kind,
    surface_id: textOf(v.surface_id),
    worktree_name: textOf(v.worktree_name),
    execution_host_id: textOf(v.execution_host_id),
    agent: textOf(v.agent),
    started_at: textOf(v.started_at),
    provider_session_id: textOf(v.provider_session_id),
    by: textOf(v.by)
  }
}

/** The task's page in the console, from the stored origin — never a URL the answer carries. */
export function buildWebIssueUrl(baseUrl: string, id: string, product: string): string {
  return `${baseUrl}/tms/issues/${encodeURIComponent(id)}?product=${encodeURIComponent(product)}`
}

export function issueRowOf(baseUrl: string, value: unknown): BuildWebIssueRow | null {
  const v = recordOf(value)
  if (!v || typeof v.id !== 'string' || typeof v.key !== 'string') {
    return null
  }
  const product = productOf(v.product)
  return {
    id: v.id,
    key: v.key,
    product,
    title: textOf(v.title),
    type: textOf(v.type),
    status: statusOf(v.status),
    priority: numberOf(v.priority, 3),
    parent_id: textOrNull(v.parent_id),
    parent_key: textOrNull(v.parent_key),
    children_open: numberOf(v.children_open),
    favorite: v.favorite === true,
    for_ai: v.for_ai === true,
    assignee: textOf(v.assignee),
    version_id: textOrNull(v.version_id),
    version_name: textOrNull(v.version_name),
    jira_key: textOrNull(v.jira_key),
    updated_at: textOf(v.updated_at),
    agent_session: agentSessionOf(v.agent_session),
    url: buildWebIssueUrl(baseUrl, v.id, textOf(v.product))
  }
}

function commentOf(value: unknown): BuildWebComment | null {
  const v = recordOf(value)
  return v && typeof v.id === 'string'
    ? { id: v.id, author: textOf(v.author), body: textOf(v.body), created_at: textOf(v.created_at) }
    : null
}

function stepOf(value: unknown): { text?: string; action?: string; expected?: string } {
  const v = recordOf(value) ?? {}
  return {
    ...(typeof v.text === 'string' ? { text: v.text } : {}),
    ...(typeof v.action === 'string' ? { action: v.action } : {}),
    ...(typeof v.expected === 'string' ? { expected: v.expected } : {})
  }
}

/** `GET /api/tms/issues/:id` → the card Orca shows. */
export function issueDetailOf(baseUrl: string, value: unknown): BuildWebIssueDetail | null {
  const card = recordOf(value)
  const issue = recordOf(card?.issue)
  const row = issueRowOf(baseUrl, issue)
  if (!card || !issue || !row) {
    return null
  }
  return {
    ...row,
    description: textOf(issue.description),
    steps: Array.isArray(issue.steps) ? issue.steps.map(stepOf) : [],
    stand_name: textOrNull(issue.stand_name),
    jira_status: textOf(issue.jira_status),
    created_by: textOf(issue.created_by),
    created_at: textOf(issue.created_at),
    updated_by: textOf(issue.updated_by),
    branches: textsOf(card.branches),
    comments: Array.isArray(card.comments)
      ? card.comments.map(commentOf).filter((c): c is BuildWebComment => c !== null)
      : []
  }
}
