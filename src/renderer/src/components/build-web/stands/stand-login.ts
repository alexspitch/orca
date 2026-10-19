import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { getClientCreationActionPolicy } from '@/lib/client-creation-action-policy'
import { isPairedWebClientWindow } from '@/lib/desktop-window-chrome'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebStandAccount,
  BuildWebStandCard
} from '../../../../../shared/build-web-stand-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'

// «Log in» on the Users tab: a tab of Orca's own browser in the open workspace, in a profile of its
// own per login; the host fills the portal's form, so the password never reaches this window.

export type StandLoginContext = {
  pairedWeb: boolean
  targetKind: RuntimeClientTarget['kind']
  worktreeId: string | null
  browser: 'local-client' | 'paired-runtime' | 'hidden'
}

/** Why no tab can open for this window and workspace; null when one can. */
export function standLoginBlockedBy(context: StandLoginContext): string | null {
  if (context.pairedWeb) {
    return translate('buildWeb.stands.users.useDesktop', 'Log in from the desktop app.')
  }
  if (context.targetKind !== 'local') {
    return translate(
      'buildWeb.stands.users.viaServer',
      'build-web is connected through an Orca server; log in from the app that holds the token.'
    )
  }
  if (!context.worktreeId) {
    return translate('buildWeb.stands.users.noWorkspace', 'Open a workspace to log in.')
  }
  return context.browser === 'local-client'
    ? null
    : translate(
        'buildWeb.stands.users.remoteBrowser',
        'This workspace’s browser runs on an Orca server; open a local workspace to log in.'
      )
}

/** Why this one account cannot log in; null when it can. */
export function accountLoginBlockedBy(
  account: BuildWebStandAccount,
  card: BuildWebStandCard | undefined
): string | null {
  if (!card?.uiUrl) {
    return translate('buildWeb.stands.users.noUi', 'The stand has no UI address.')
  }
  if (account.password === 'broken') {
    return translate('buildWeb.stands.users.passwordBroken', 'The password does not decrypt.')
  }
  return account.password === 'missing'
    ? translate('buildWeb.stands.users.passwordMissing', 'No password is set.')
    : null
}

export function useStandLoginContext(target: RuntimeClientTarget): StandLoginContext {
  return useAppStore(
    useShallow((s): StandLoginContext => {
      const worktreeId = s.activeWorktreeId ?? null
      const policy = getClientCreationActionPolicy(s, worktreeId)['managed-browser']
      return {
        pairedWeb: isPairedWebClientWindow(),
        targetKind: target.kind,
        worktreeId,
        browser: policy.state === 'enabled' ? policy.provider : 'hidden'
      }
    })
  )
}

/** Open the login tab; the error is the console's or the browser's, for the row. */
export async function openStandLogin(
  target: RuntimeClientTarget,
  worktreeId: string,
  accountId: string
): Promise<string | null> {
  const browserPageId = createBrowserUuid()
  const result = await callBuildWeb(target, 'standLogin', { accountId, browserPageId })
  if (!result.ok) {
    return result.error
  }
  const store = useAppStore.getState()
  // Why: the tab names its profile; the renderer must know the profile before it mounts the page.
  await store.fetchBrowserSessionProfiles()
  store.createBrowserTab(worktreeId, result.value.url, {
    activate: true,
    browserPageId,
    title: result.value.title,
    sessionProfileId: result.value.profileId,
    sessionPartition: result.value.partition,
    browserRuntimeEnvironmentId: null
  })
  store.setActiveView('terminal')
  return null
}
