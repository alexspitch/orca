import type { BuildWebStandService } from '../../../../../shared/build-web-stand-types'
import { isFailingService } from '../../../../../shared/build-web-stand-services'
import type { ChipTone } from '../build-web-tones'

// How a stand's services read in the table: the state's colour and label.

export function serviceStateTone(service: BuildWebStandService): ChipTone {
  if (isFailingService(service)) {
    return 'red'
  }
  if (service.state === 'running') {
    return service.health === 'starting' ? 'amber' : 'green'
  }
  switch (service.state) {
    case 'restarting':
      return 'amber'
    case 'absent':
      return 'faint'
    default:
      return 'neutral'
  }
}

export function serviceStateLabel(service: BuildWebStandService): string {
  return service.health && service.state === 'running'
    ? `${service.state} · ${service.health}`
    : service.state
}
