import { newTabPromptLaunchesThroughHost } from '@/lib/launch-agent-new-tab-host-route'

export { withClaudeLaunchAccount } from '../../../shared/claude-launch-account'

/** Custom build: a launch naming a Claude account stays off the host, whose plan drops the account. */
export function promptLaunchesThroughHost(
  args: { claudeAccountId?: string },
  route: Parameters<typeof newTabPromptLaunchesThroughHost>[0]
): boolean {
  return !args.claudeAccountId && newTabPromptLaunchesThroughHost(route)
}
