import type { z } from 'zod'
import type {
  BuildWebStandIdsParams,
  BuildWebStandLogsReadParams,
  BuildWebStandLogsStartParams,
  BuildWebStandLogsStopParams,
  BuildWebStandOpParams
} from '../../shared/rpc-contract/build-web-stand-params'
import type { BuildWebStandParams } from '../../shared/rpc-contract/build-web-task-params'
import {
  readBuildWebStandLogs,
  startBuildWebStandLogs,
  stopBuildWebStandLogs
} from '../build-web/build-web-stand-logs'
import {
  listBuildWebStandAccounts,
  listBuildWebStandGroups,
  listBuildWebStandJobs,
  readBuildWebStandStatus,
  startBuildWebStandOp
} from '../build-web/build-web-stands'

type In<T extends z.ZodTypeAny> = z.infer<T>

// The «Stands» page's calls. Every name starts with `buildWeb`: the edge controller binds this
// class by that prefix, beside RuntimeBuildWebCommands. «Log in» is not here: it drives this
// desktop's own browser, which a headless runtime does not have (see ipc/build-web-stands.ts).
export class RuntimeBuildWebStandCommands {
  buildWebStandGroups() {
    return listBuildWebStandGroups()
  }

  buildWebStandStatus(args: In<typeof BuildWebStandParams>) {
    return readBuildWebStandStatus(args.standId)
  }

  buildWebStandAccounts(args: In<typeof BuildWebStandIdsParams>) {
    return listBuildWebStandAccounts(args.standIds)
  }

  buildWebStandJobs(args: In<typeof BuildWebStandIdsParams>) {
    return listBuildWebStandJobs(args.standIds)
  }

  buildWebStandOp(args: In<typeof BuildWebStandOpParams>) {
    return startBuildWebStandOp(args)
  }

  buildWebStartStandLogs(args: In<typeof BuildWebStandLogsStartParams>) {
    return startBuildWebStandLogs(args)
  }

  buildWebStandLogs(args: In<typeof BuildWebStandLogsReadParams>) {
    return readBuildWebStandLogs(args)
  }

  buildWebStopStandLogs(args: In<typeof BuildWebStandLogsStopParams>) {
    return stopBuildWebStandLogs(args)
  }
}
