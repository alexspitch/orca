import type { BuildWebTrainRunStatus } from '../../../../../shared/build-web-train-types'
import type { ChipTone } from '../build-web-tones'

/** A window going is blue, done green, failed red, a skipped one plain. */
export function trainRunTone(status: BuildWebTrainRunStatus): ChipTone | null {
  switch (status) {
    case 'scanning':
    case 'building':
    case 'deploying':
    case 'reporting':
      return 'blue'
    case 'done':
      return 'green'
    case 'failed':
      return 'red'
    case 'skipped':
      return null
  }
}
