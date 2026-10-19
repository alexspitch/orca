import type { BuildWebMutationResult } from '../../shared/build-web-types'
import type { BuildWebJob } from '../../shared/build-web-task-types'
import type {
  BuildWebLogPiece,
  BuildWebStandAccount,
  BuildWebStandGroup,
  BuildWebStandLoginTarget,
  BuildWebStandLogTail,
  BuildWebStandOpKind,
  BuildWebStandStatus
} from '../../shared/build-web-stand-types'

// The «Stands» page's calls; one object per call, as the RPC params.
export type BuildWebStandApi = {
  standGroups: () => Promise<BuildWebMutationResult<BuildWebStandGroup[]>>
  standStatus: (args: { standId: string }) => Promise<BuildWebMutationResult<BuildWebStandStatus>>
  standAccounts: (args: {
    standIds: string[]
  }) => Promise<BuildWebMutationResult<BuildWebStandAccount[]>>
  standJobs: (args: { standIds: string[] }) => Promise<BuildWebMutationResult<BuildWebJob[]>>
  standOp: (args: {
    standId: string
    kind: BuildWebStandOpKind
    services?: string[]
  }) => Promise<BuildWebMutationResult<BuildWebJob>>
  startStandLogs: (args: {
    standId: string
    service: string
    tail: BuildWebStandLogTail
    follow: boolean
  }) => Promise<BuildWebMutationResult<{ streamId: string }>>
  standLogs: (args: { streamId: string; offset: number }) => Promise<BuildWebLogPiece>
  stopStandLogs: (args: { streamId: string }) => Promise<boolean>
  standLogin: (args: {
    accountId: string
    browserPageId: string
  }) => Promise<BuildWebMutationResult<BuildWebStandLoginTarget>>
}
