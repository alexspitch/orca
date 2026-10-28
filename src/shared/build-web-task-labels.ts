import type { BuildWebTaskState } from './build-web-activity-types'

// IS-10: the words of the console's /tasks filters (web/src/task-view.ts), in English — the phone
// shows them as they are, the desktop through its translations.

export const BUILD_WEB_TASK_KIND_LABELS: Record<string, string> = {
  build: 'Build',
  redos: 'Redos',
  deploy: 'Deploy',
  generate: 'Config generation',
  up: 'Services up',
  restart: 'Services restart',
  apply: 'Settings apply',
  shots: 'Screenshots',
  guide: 'Guide',
  tms: 'Applicability analysis',
  'tms-script': 'Test script',
  'tms-scripts': 'Test scripts',
  automation: 'Automations',
  test: 'Tests'
}

export const BUILD_WEB_TASK_STATE_LABELS: Record<BuildWebTaskState, string> = {
  active: 'running',
  stale: 'went quiet',
  success: 'success',
  partial: 'partial',
  failed: 'failed',
  cancelled: 'cancelled'
}

export const taskKindLabel = (kind: string): string => BUILD_WEB_TASK_KIND_LABELS[kind] ?? kind
