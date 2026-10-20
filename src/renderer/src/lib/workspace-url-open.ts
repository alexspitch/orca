import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import type { useAppStore } from '@/store'
import type { RuntimeClientTarget } from '../../../shared/runtime-client-target'

type BrowserTabCreator = ReturnType<typeof useAppStore.getState>['createBrowserTab']

/**
 * Open an address a workspace's tooling reported. Unlike a detected port, it is meant to be reached
 * from this client as-is, so it opens here — an Orca browser tab for a local workspace when links
 * open in the app, else the system browser — and never as a screencast from the host.
 */
export async function openUrlForWorkspace(args: {
  url: string
  worktreeId: string
  runtimeTarget: RuntimeClientTarget | null
  openInOrcaBrowser: boolean
  createBrowserTab: BrowserTabCreator
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  let parsed: URL
  try {
    parsed = new URL(args.url)
  } catch {
    return { ok: false, reason: 'The address is not a valid URL.' }
  }
  // Why: the URL comes from a repository command's output; anything but a web page stays closed.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only http and https addresses open.' }
  }
  try {
    if (args.openInOrcaBrowser && args.runtimeTarget?.kind === 'local') {
      // Why: the browser tab is this jump's surface; seeding a shell would add an unasked-for PTY.
      activateAndRevealWorktree(args.worktreeId, { providesInitialSurface: true })
      args.createBrowserTab(args.worktreeId, parsed.href, { activate: true })
    } else {
      await window.api.shell.openUrl(parsed.href)
    }
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, reason: message || 'Failed to open the browser.' }
  }
}
