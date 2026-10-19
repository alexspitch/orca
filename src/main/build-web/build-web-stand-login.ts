import type { BrowserSessionProfile } from '../../shared/browser-workspace-types'
import type { BuildWebMutationResult } from '../../shared/build-web-types'
import type { BuildWebStandLoginTarget } from '../../shared/build-web-stand-types'
import { armLoginAutofill } from '../browser/browser-login-autofill'
import { browserSessionRegistry } from '../browser/browser-session-registry'
import { requireBuildWebCredential } from './build-web-connection'
import { buildWebMutation, buildWebRequest } from './build-web-request'
import { recordOf, textOf } from './build-web-response-fields'

// «Log in» on a stand's Users tab: a browser profile of its own per login, so several users of one
// stand stay signed in side by side, and the portal's form filled in main.

const enc = encodeURIComponent
// Why: a double click must not mint two profiles of the same name.
const creating = new Map<string, Promise<BrowserSessionProfile | null>>()

async function profileFor(label: string): Promise<BrowserSessionProfile> {
  const existing = browserSessionRegistry
    .listProfiles()
    .find((p) => p.scope === 'isolated' && p.label === label)
  if (existing) {
    return existing
  }
  let pending = creating.get(label)
  if (!pending) {
    pending = browserSessionRegistry.createProfile('isolated', label)
    creating.set(label, pending)
    void pending.finally(() => creating.delete(label)).catch(() => {})
  }
  const profile = await pending
  if (!profile) {
    throw new Error('Orca could not create a browser profile for this login')
  }
  return profile
}

export function startBuildWebStandLogin(args: {
  accountId: string
  browserPageId: string
}): Promise<BuildWebMutationResult<BuildWebStandLoginTarget>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        method: 'POST',
        path: `/api/ui-accounts/${enc(args.accountId)}/credentials`
      })
    )
    const email = textOf(answer?.email)
    const password = textOf(answer?.password)
    const url = textOf(answer?.ui_url)
    let hostname: string
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error('not http')
      }
      hostname = parsed.hostname
    } catch {
      throw new Error('build-web gave no usable address for this stand')
    }
    if (!email || !password) {
      throw new Error('build-web gave no login for this account')
    }
    const title = `${textOf(answer?.stand_name) || hostname} · ${email}`
    const profile = await profileFor(title)
    armLoginAutofill(args.browserPageId, { username: email, password, hostname })
    return { profileId: profile.id, partition: profile.partition, url, title }
  })
}
