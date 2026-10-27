import { useEffect, useState } from 'react'
import {
  resolveTuiAgentLaunchArgs,
  type AgentLaunchProfileSettings
} from '../../../../src/shared/tui-agent-launch-defaults'
import {
  isAgentPermissionChoice,
  normalizeAgentPermissionOverrides
} from '../../../../src/shared/tui-agent-permission-choice'
import { settingsRead } from '../../transport/settings-read-operations'
import type { RpcClient } from '../../transport/rpc-client'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function stringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
}

function envRecord(value: unknown): Record<string, Record<string, string>> | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([agent, env]) => {
      const strings = stringRecord(env)
      return strings ? [[agent, strings]] : []
    })
  )
}

/** The launch-profile fields of the host's settings, each kept only when it reads as its type. */
function profileOf(settings: unknown): AgentLaunchProfileSettings | null {
  if (!isRecord(settings)) {
    return null
  }
  const profile: AgentLaunchProfileSettings = {}
  const args = stringRecord(settings.agentDefaultArgs)
  const env = envRecord(settings.agentDefaultEnv)
  if (args) {
    profile.agentDefaultArgs = args
  }
  if (env) {
    profile.agentDefaultEnv = env
  }
  if (isAgentPermissionChoice(settings.agentPermissionDefault)) {
    profile.agentPermissionDefault = settings.agentPermissionDefault
  }
  if (settings.agentPermissionOverrides !== undefined) {
    profile.agentPermissionOverrides = normalizeAgentPermissionOverrides(
      settings.agentPermissionOverrides
    )
  }
  return profile
}

/**
 * The arguments the host itself starts Claude with; null until read or when unreadable, so the
 * launch then leaves them to the host rather than replace the person's own with defaults.
 */
export function useHostClaudeArgs(client: RpcClient): string | null {
  const [args, setArgs] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const reply = settingsRead.interpret(await settingsRead.request(client))
        const profile = reply.accepted ? profileOf(reply.value) : null
        if (alive && profile) {
          setArgs(resolveTuiAgentLaunchArgs('claude', profile))
        }
      } catch {
        // Unread settings leave the arguments to the host.
      }
    })()
    return () => {
      alive = false
    }
  }, [client])
  return args
}
