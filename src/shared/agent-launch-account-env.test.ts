import { describe, expect, it } from 'vitest'
import { AgentLaunchAccountEnv } from './agent-launch-account-env'

describe('the account env a host-built agent takes', () => {
  it('takes the routing paths and the id of a named Claude account', () => {
    expect(
      AgentLaunchAccountEnv.safeParse({
        CLAUDE_CONFIG_DIR: '/home/me/Claude/work',
        ORCA_CLAUDE_LAUNCH_ACCOUNT: '1f8dbc54-34de-4604-8255-af6a0d291456'
      }).success
    ).toBe(true)
  })

  it('refuses an account id that is not one, and any other variable', () => {
    expect(AgentLaunchAccountEnv.safeParse({ ORCA_CLAUDE_LAUNCH_ACCOUNT: '../x' }).success).toBe(
      false
    )
    expect(AgentLaunchAccountEnv.safeParse({ ORCA_CLAUDE_LAUNCH_ACCOUNT: '' }).success).toBe(false)
    expect(AgentLaunchAccountEnv.safeParse({ PATH: '/usr/bin' }).success).toBe(false)
  })
})
