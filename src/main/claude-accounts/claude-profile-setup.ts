import { existsSync } from 'node:fs'
import type { AgentHookInstallStatus } from '../../shared/agent-hook-types'
import { resolveExternalClaudeConfigDir } from './claude-external-config-dir'
import { shareClaudeProfileHistory } from './claude-profile-history'
import {
  claudeProfileMarkerPath,
  prepareClaudeProfileDirectory,
  type ClaudeProfileDescriptor
} from './claude-profile-paths'
import { provisionClaudeProfile } from './claude-profile-provisioning'
import {
  ClaudeProfileSurfaceError,
  createClaudeProfileReport,
  runClaudeProfileSurface,
  warnClaudeProfile,
  type ClaudeProfileReport
} from './claude-profile-report'

/** `refused` means ownership validation failed before any writes. */
export type ClaudeProfileSetupReport = ClaudeProfileReport & { outcome: 'refused' | 'prepared' }

type ClaudeProfileSetupArgs = {
  dataRoot: string
  profile: ClaudeProfileDescriptor
  userHome: string
  /** The user's own CLAUDE_CONFIG_DIR; defaults to `~/.claude`. */
  userConfigDir?: string
  /** Runs after settings are copied so hook entries survive; null disables installation. */
  installHooks: ((target: { configDir: string }) => AgentHookInstallStatus) | null
  platform?: NodeJS.Platform
}

/**
 * The one entry for setting up a managed Claude profile. Runs on the execution host that owns the
 * profile; for WSL that is inside the guest, never across a UNC path.
 */
export async function provisionClaudeAccountProfile(
  args: ClaudeProfileSetupArgs
): Promise<ClaudeProfileSetupReport> {
  if (args.profile.external) {
    return provisionExternalClaudeProfile(args)
  }
  const platform = args.platform ?? process.platform
  const report = createClaudeProfileReport()
  const firstSetup = !existsSync(claudeProfileMarkerPath(args.profile))
  let markSetUp: () => void
  try {
    if (args.profile.target.runtime === 'wsl' && platform === 'win32') {
      throw new ClaudeProfileSurfaceError('invalid-profile', 'WSL profiles are set up in the guest')
    }
    markSetUp = prepareClaudeProfileDirectory(
      args.dataRoot,
      args.profile,
      args.userHome,
      args.userConfigDir
    )
  } catch (error) {
    report.surfaces.profile = 'failed'
    warnClaudeProfile(report, 'profile', error)
    return { outcome: 'refused', ...report }
  }
  const home = args.profile.home
  const shared = { profileHome: home, userHome: args.userHome, userConfigDir: args.userConfigDir }
  for (const step of [
    () => shareClaudeProfileHistory({ ...shared, platform }),
    () => provisionClaudeProfile({ ...shared, platform, firstSetup })
  ]) {
    try {
      const part = await step()
      Object.assign(report.surfaces, part.surfaces)
      report.warnings.push(...part.warnings)
    } catch (error) {
      warnClaudeProfile(report, 'profile', error)
    }
  }
  await installProfileHooks(report, args.installHooks, home)
  // Last: a setup cut off before here leaves no marker, so the next launch waits for a full one.
  markSetUp()
  return { outcome: 'prepared', ...report }
}

/** The user's own folder gets only the gate and Orca's hooks, and no marker: launches never wait on it. */
async function provisionExternalClaudeProfile(
  args: ClaudeProfileSetupArgs
): Promise<ClaudeProfileSetupReport> {
  const report = createClaudeProfileReport()
  const home = args.profile.home
  try {
    // Why again at every setup: System default may since have moved onto this folder.
    const checked = resolveExternalClaudeConfigDir(home, args)
    if (checked !== home) {
      throw new ClaudeProfileSurfaceError('invalid-profile', 'Claude folder path is not normalized')
    }
  } catch (error) {
    report.surfaces.profile = 'failed'
    warnClaudeProfile(report, 'profile', error)
    return { outcome: 'refused', ...report }
  }
  await installProfileHooks(report, args.installHooks, home)
  return { outcome: 'prepared', ...report }
}

function installProfileHooks(
  report: ClaudeProfileReport,
  installHooks: ClaudeProfileSetupArgs['installHooks'],
  configDir: string
): Promise<void> {
  return runClaudeProfileSurface(report, 'hooks', () => {
    if (!installHooks) {
      return 'absent'
    }
    const status = installHooks({ configDir })
    if (status.state !== 'installed') {
      throw new Error(status.detail ?? `Claude hooks ${status.state}`)
    }
    return 'merged'
  })
}
