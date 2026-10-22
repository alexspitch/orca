import { translate } from '@/i18n/i18n'
import type { BuildWebTrain } from '../../../../../shared/build-web-train-types'

/** The stand a train deploys to; a chat-platform train may have none and only builds. */
export function trainStandLabel(train: Pick<BuildWebTrain, 'stand_id' | 'stand_name'>): string {
  return train.stand_id ? train.stand_name : translate('buildWeb.trains.noStand', 'no stand')
}
