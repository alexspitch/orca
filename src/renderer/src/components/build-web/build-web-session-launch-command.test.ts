import { describe, expect, it } from 'vitest'
import { planLaunchAgentStartupPrompt } from '@/lib/launch-agent-startup-prompt-plan'
import { claudeNameArgs, taskSessionName } from './build-web-task-session'
import { buildWebBatchPrompt } from './build-web-take-to-work'

// What «Take to work» actually starts: claude with the user's own arguments and the session's name,
// the skill call pasted once the TUI is ready.

const issues = [
  { key: 'SDAP-3931', title: 'Login fails on "SSO"' },
  { key: 'SDAP-3932', title: 'Export hangs' }
]

describe('the take-to-work launch', () => {
  it.each([
    ['posix', 'darwin'],
    ['powershell', 'win32']
  ] as const)('names the Claude session after the tasks (%s)', (shell, platform) => {
    const name = taskSessionName(issues)
    const plan = planLaunchAgentStartupPrompt({
      base: {
        agent: 'claude',
        cmdOverrides: {},
        platform,
        shell,
        isRemote: false,
        agentArgs: claudeNameArgs('--model opus', name),
        agentEnv: undefined
      },
      prompt: buildWebBatchPrompt(
        issues.map((i) => i.key),
        { auto: false }
      ),
      promptDelivery: 'submit-after-ready',
      isFollowupPath: false
    })
    expect(name).toBe('SDAP-3931 Login fails on "SSO"; SDAP-3932 Export hangs')
    const command = plan.startupPlan?.launchCommand ?? ''
    // The user's own arguments stay, and the name follows them as one quoted value.
    expect(command.indexOf('opus')).toBeLessThan(command.indexOf('--name'))
    expect(command).toContain('SDAP-3931 Login fails on ”SSO”; SDAP-3932 Export hangs')
    expect(plan.pasteDraftAfterLaunch).toBe(
      '/build-web-tasks batch SDAP-3931 SDAP-3932 -no-worktree'
    )
  })
})
