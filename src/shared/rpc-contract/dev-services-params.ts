import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'
import {
  DEV_SERVICES_MAX_ARG_LENGTH,
  DEV_SERVICES_MAX_ARGS,
  DEV_SERVICES_VERB_PATTERN
} from '../dev-services-contract'

const DevServicesTargetParams = {
  worktree: requiredString('Missing worktree selector'),
  // Why: the host re-hashes orca.yaml's command and refuses one the user has not trusted.
  commandHash: requiredString('Missing services command hash')
}

export const DevServicesStatusParams = z.object(DevServicesTargetParams)

export const DevServicesRunParams = z.object({
  ...DevServicesTargetParams,
  verb: z.string().regex(DEV_SERVICES_VERB_PATTERN, 'Invalid services verb'),
  args: z.array(z.string().max(DEV_SERVICES_MAX_ARG_LENGTH)).max(DEV_SERVICES_MAX_ARGS)
})
