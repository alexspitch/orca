import type { BuildWebIssueStatus } from '../../../../shared/build-web-types'
import type { BuildWebImageBuildStatus } from '../../../../shared/build-web-image-types'

// The colour of each value, after build-web's issue.ts, product.ts and vocab.ts: the same hue for
// the same value in the list, the card and the filter. Hues are main.css chip-tone tokens.

export type ChipTone =
  | 'neutral'
  | 'faint'
  | 'blue'
  | 'purple'
  | 'cyan'
  | 'sky'
  | 'green'
  | 'amber'
  | 'ochre'
  | 'orange'
  | 'red'
  | 'crimson'

export function statusTone(status: BuildWebIssueStatus): ChipTone | null {
  switch (status) {
    case 'todo':
      return 'neutral'
    case 'planned':
      return 'cyan'
    case 'inprogress':
      return 'blue'
    case 'paused':
      return 'faint'
    case 'awaiting_response':
      return 'orange'
    case 'deploying':
      return 'sky'
    case 'build_failed':
      return 'crimson'
    case 'testing':
      return 'amber'
    case 'testing_external':
      return 'ochre'
    case 'done':
      return 'green'
    // The one end that is not a success: red, not grey like «to do».
    case 'wontfix':
      return 'red'
    case 'unknown':
      return null
  }
}

/** Images name a fifth group, `other`; an unknown product has no colour. */
export function productTone(product: string): ChipTone | null {
  switch (product) {
    case 'sa':
      return 'purple'
    case 'dc':
      return 'blue'
    case 'ap':
      return 'green'
    case 'storage':
      return 'orange'
    case 'tools':
    case 'other':
      return 'neutral'
    default:
      return null
  }
}

export function priorityTone(priority: number): ChipTone {
  return priority >= 5
    ? 'red'
    : priority === 4
      ? 'orange'
      : priority === 3
        ? 'amber'
        : priority === 2
          ? 'cyan'
          : 'neutral'
}

export function typeTone(type: string): ChipTone {
  return type === 'bug' ? 'red' : type === 'improvement' ? 'cyan' : 'neutral'
}

/** A run's or a build's raw status (SUCCESS, FAILURE, building, partial…). */
export function runStatusTone(status: string): ChipTone | null {
  if (/^success$/i.test(status)) {
    return 'green'
  }
  if (/fail|abort|error/i.test(status)) {
    return 'red'
  }
  if (/partial|unstable/i.test(status)) {
    return 'amber'
  }
  return /build|running|queued|pending/i.test(status) ? 'cyan' : null
}

export function imageBuildTone(status: BuildWebImageBuildStatus): ChipTone {
  return status === 'success' ? 'green' : status === 'failed' ? 'red' : 'cyan'
}

// Jira's status names are free text per workflow, so the colour is matched on the name and an
// unrecognised one stays neutral; first match wins (build-web's jira-status.ts).
const JIRA_RULES: [RegExp, ChipTone][] = [
  [/reject|cancel|declin|block/i, 'red'],
  [/done|closed|resolved|complet/i, 'green'],
  [/test|qa/i, 'amber'],
  [/review|verif/i, 'purple'],
  [/progress|develop|implement/i, 'cyan']
]

export function jiraStatusTone(status: string): ChipTone | null {
  return JIRA_RULES.find(([re]) => re.test(status))?.[1] ?? null
}
