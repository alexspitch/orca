import { translate } from '@/i18n/i18n'
import type { BuildWebTaskState } from '../../../../../shared/build-web-activity-types'

// IS-10: the words of the task filters, after the console's web/src/task-view.ts.

export function taskKindText(kind: string): string {
  switch (kind) {
    case 'build':
      return translate('buildWeb.tasks.kindBuild', 'Build')
    case 'redos':
      return translate('buildWeb.tasks.kindRedos', 'Redos')
    case 'deploy':
      return translate('buildWeb.tasks.kindDeploy', 'Deploy')
    case 'generate':
      return translate('buildWeb.tasks.kindGenerate', 'Config generation')
    case 'up':
      return translate('buildWeb.tasks.kindUp', 'Services up')
    case 'restart':
      return translate('buildWeb.tasks.kindRestart', 'Services restart')
    case 'apply':
      return translate('buildWeb.tasks.kindApply', 'Settings apply')
    case 'shots':
      return translate('buildWeb.tasks.kindShots', 'Screenshots')
    case 'guide':
      return translate('buildWeb.tasks.kindGuide', 'Guide')
    case 'tms':
      return translate('buildWeb.tasks.kindTms', 'Applicability analysis')
    case 'tms-script':
      return translate('buildWeb.tasks.kindTmsScript', 'Test script')
    case 'tms-scripts':
      return translate('buildWeb.tasks.kindTmsScripts', 'Test scripts')
    case 'automation':
      return translate('buildWeb.tasks.kindAutomation', 'Automations')
    case 'test':
      return translate('buildWeb.tasks.kindTest', 'Tests')
    default:
      return kind
  }
}

export function taskStateText(state: BuildWebTaskState): string {
  switch (state) {
    case 'active':
      return translate('buildWeb.tasks.stateActive', 'running')
    case 'stale':
      return translate('buildWeb.tasks.stateStale', 'went quiet')
    case 'success':
      return translate('buildWeb.tasks.stateSuccess', 'success')
    case 'partial':
      return translate('buildWeb.tasks.statePartial', 'partial')
    case 'failed':
      return translate('buildWeb.tasks.stateFailed', 'failed')
    case 'cancelled':
      return translate('buildWeb.tasks.stateCancelled', 'cancelled')
  }
}
