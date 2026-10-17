import type {
  BuildWebConnectArgs,
  BuildWebConnectResult,
  BuildWebConnectionStatus
} from '../../shared/build-web-types'
import {
  clearBuildWebCredential,
  getBuildWebCredentialError,
  getBuildWebCredentialProtection,
  getStoredBuildWebMetadata,
  hasStoredBuildWebCredential,
  loadBuildWebToken,
  saveBuildWebCredential
} from './credential-store'
import {
  BuildWebApiError,
  buildWebRequest,
  describeBuildWebError,
  normalizeBuildWebBaseUrl
} from './build-web-request'
import { recordOf, textOf, textsOf } from './build-web-response-fields'

const VERIFY_TIMEOUT_MS = 8000

type Who = { login: string; perms: string[] }

async function whoIs(baseUrl: string, token: string): Promise<Who> {
  const me = recordOf(
    await buildWebRequest({ baseUrl, token, path: '/api/me', timeoutMs: VERIFY_TIMEOUT_MS })
  )
  // Why: /api/me answers 200 with authed:false when the token is not taken.
  if (me?.authed !== true) {
    throw new BuildWebApiError('token is unknown or revoked', 401)
  }
  return { login: textOf(me.user) || textOf(me.name), perms: textsOf(me.perms) }
}

/** Verify against `/api/me` before saving, so a dead token is refused inline. */
export async function connectBuildWeb(args: BuildWebConnectArgs): Promise<BuildWebConnectResult> {
  const baseUrl = normalizeBuildWebBaseUrl(args.baseUrl)
  if (!baseUrl) {
    return { ok: false, error: 'Enter the build-web address as https://host:port.' }
  }
  const token = args.token.trim()
  if (!token) {
    return { ok: false, error: 'Enter a build-web API token.' }
  }
  try {
    const who = await whoIs(baseUrl, token)
    saveBuildWebCredential({ baseUrl, token, ...who })
    return { ok: true, status: getBuildWebStatus() }
  } catch (error) {
    return { ok: false, error: describeBuildWebError(error) }
  }
}

export function disconnectBuildWeb(): BuildWebConnectionStatus {
  clearBuildWebCredential()
  return getBuildWebStatus()
}

/** Reads plaintext metadata only — never decrypts — so it is safe on every status poll. */
export function getBuildWebStatus(): BuildWebConnectionStatus {
  const metadata = hasStoredBuildWebCredential() ? getStoredBuildWebMetadata() : null
  if (!metadata) {
    return { connected: false, baseUrl: null, login: null, perms: [], credentialProtection: null }
  }
  return {
    connected: true,
    baseUrl: metadata.baseUrl,
    login: metadata.login,
    perms: metadata.perms,
    credentialProtection: getBuildWebCredentialProtection(),
    credentialError: getBuildWebCredentialError()
  }
}

export type BuildWebCredential = { baseUrl: string; token: string }

/**
 * The stored server and token, decrypting on first use; throws when not connected. `background`
 * callers (the sidebar badge) never retry a decrypt that already failed — it may prompt again.
 */
export function requireBuildWebCredential(options?: { background?: true }): BuildWebCredential {
  if (options?.background && getBuildWebCredentialError()) {
    throw new BuildWebApiError('build-web token is locked', 401)
  }
  const metadata = getStoredBuildWebMetadata()
  const token = metadata ? loadBuildWebToken(metadata.baseUrl) : null
  if (!metadata || !token) {
    throw new BuildWebApiError('build-web is not connected', 401)
  }
  return { baseUrl: metadata.baseUrl, token }
}

/** Re-read who the token is (and refresh the stored sections) — Settings' «Test connection». */
export async function testBuildWebConnection(): Promise<BuildWebConnectResult> {
  try {
    const credential = requireBuildWebCredential()
    const who = await whoIs(credential.baseUrl, credential.token)
    saveBuildWebCredential({ ...credential, ...who })
    return { ok: true, status: getBuildWebStatus() }
  } catch (error) {
    return { ok: false, error: describeBuildWebError(error) }
  }
}
