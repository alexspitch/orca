import { translate } from '@/i18n/i18n'
import type { BuildWebTrainAction } from '../../../../../shared/build-web-train-types'

// One row of a train's journal in words, after build-web's train-action-line.ts. `detail` is a
// free-form bag, so each kind reads its own keys.

const words = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
const text = (value: unknown, fallback = '?'): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback

export function trainActionLine(action: BuildWebTrainAction): string {
  const d = action.detail
  const number = d.build_number ? ` #${text(d.build_number)}` : ''
  const why = action.error ?? translate('buildWeb.trains.noReason', 'no reason given')
  switch (action.kind) {
    case 'build': {
      if (action.outcome !== 'SUCCESS') {
        return action.outcome === 'ABORTED'
          ? translate('buildWeb.trains.buildAborted', 'build aborted: {{target}}{{n}}', {
              target: action.target,
              n: number
            })
          : translate('buildWeb.trains.buildFailed', 'build failed: {{target}}{{n}}', {
              target: action.target,
              n: number
            })
      }
      const tags = words(d.tags)
      return translate('buildWeb.trains.built', 'built {{target}}{{n}}{{tags}}', {
        target: action.target,
        n: number,
        tags: tags.length ? ` — ${tags.join(', ')}` : ''
      })
    }
    case 'push': {
      const note = d.note ? ` — ${text(d.note)}` : ''
      if (action.outcome === 'queued') {
        return translate('buildWeb.trains.pushQueued', 'publishing {{target}} queued{{note}}', {
          target: action.target,
          note
        })
      }
      if (action.outcome === 'failed') {
        return translate(
          'buildWeb.trains.pushNotQueued',
          'publishing {{target}} not queued — {{why}}',
          {
            target: action.target,
            why
          }
        )
      }
      const tags = words(d.tags)
      return translate('buildWeb.trains.pushed', 'published {{target}}{{tags}}', {
        target: action.target,
        tags: tags.length ? ` — ${tags.join(', ')}` : ''
      })
    }
    case 'deploy': {
      const pins = Array.isArray(d.pins) ? d.pins.length : 0
      return translate('buildWeb.trains.deployed', 'deployed to {{target}}{{pins}}', {
        target: action.target,
        pins: pins
          ? translate('buildWeb.trains.pins', ', services pinned: {{n}}', { n: String(pins) })
          : ''
      })
    }
    case 'build_task': {
      const images =
        words(d.images).join(', ') || translate('buildWeb.trains.noImages', 'no images')
      const comment = d.comment
        ? d.comment === 'created'
          ? translate('buildWeb.trains.commentCreated', ', comment created')
          : translate('buildWeb.trains.commentUpdated', ', comment updated')
        : ''
      return d.created
        ? translate(
            'buildWeb.trains.taskCreated',
            'build task {{target}} created: {{images}}{{comment}}',
            {
              target: action.target,
              images,
              comment
            }
          )
        : translate(
            'buildWeb.trains.taskUpdated',
            'build task {{target}} updated: {{images}}{{comment}}',
            {
              target: action.target,
              images,
              comment
            }
          )
    }
    case 'jira_comment':
      return translate('buildWeb.trains.reported', 'report written to {{target}}', {
        target: action.target
      })
    case 'jira_transition':
      return `${action.target}: «${text(d.from)}» → «${text(d.to)}»${
        d.watch_seeded ? '' : translate('buildWeb.trains.watchNotSeeded', ' (watch not seeded)')
      }`
    case 'ticket_skipped':
      if (action.outcome === 'retry') {
        return translate(
          'buildWeb.trains.retry',
          '{{target}}: attempt {{n}}{{of}} failed — {{why}}',
          {
            target: action.target,
            n: text(d.attempts),
            of: d.of ? ` / ${text(d.of)}` : '',
            why
          }
        )
      }
      if (d.want) {
        return translate(
          'buildWeb.trains.jiraRefused',
          '{{target}}: Jira did not move it to «{{want}}» — {{why}}',
          { target: action.target, want: text(d.want), why }
        )
      }
      return action.outcome === 'failed'
        ? translate('buildWeb.trains.notMoved', '{{target}} not moved — {{why}}', {
            target: action.target,
            why
          })
        : translate('buildWeb.trains.leftInPlace', '{{target}} left in place — {{why}}', {
            target: action.target,
            why
          })
    case 'failed':
      return translate('buildWeb.trains.stepFailed', 'step {{target}} failed — {{why}}', {
        target: action.target,
        why
      })
  }
}
