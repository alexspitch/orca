import { z } from 'zod'

export const ClientUiWorkspaceFilterFields = {
  hideDefaultBranchWorkspace: z.boolean().optional(),
  hideAutomationGeneratedWorkspaces: z.boolean().optional(),
  hideCliCreatedWorkspaces: z.boolean().optional(),
  hideDetachedHeadWorkspaces: z.boolean().optional(),
  // IS-147: lenient strings so a newer client's lane never rejects the whole payload; read normalizes.
  hiddenSessionStates: z.array(z.string().max(32)).max(8).optional(),
  hideWorkspacesFromOtherDevices: z.boolean().optional(),
  alwaysShowDefaultBranchWorkspace: z.boolean().optional(),
  filterRepoIds: z.array(z.string()).optional()
}
