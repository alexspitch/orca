import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  CredentialDecryptionError,
  credentialFileHasContent,
  readStoredCredentialToken,
  writeCredentialFileAtomic,
  writeEncryptedCredential
} from '../integration-credential-file'
import { readCredentialFileProtection } from '../credential-file-protection'
import type { SecretAtRestProtection } from '../../shared/secret-at-rest-protection'
import { isMissingFileError, recordOf, textsOf } from './build-web-response-fields'

// Why: the token stays encrypted while this metadata stays plaintext, so a status
// read names the account without decrypting (no keychain prompt per Settings open).
export type BuildWebStoredMetadata = {
  version: 1
  baseUrl: string
  login: string
  perms: string[]
  updatedAt: string
}

// Why: the secret carries its base URL, so a torn write between the two files can
// never pair a token with a server it was not issued for.
type BuildWebStoredSecret = { token: string; baseUrl: string }

let cachedMetadata: BuildWebStoredMetadata | null = null
let metadataLoaded = false
let cachedSecret: BuildWebStoredSecret | null = null
let credentialError: string | null = null
/** Bumped on every save and clear, so whatever was read under another token can tell. */
let credentialGeneration = 0

function orcaDir(): string {
  return join(homedir(), '.orca')
}

function metadataPath(): string {
  return join(orcaDir(), 'build-web-credential.json')
}

export function getBuildWebSecretPath(): string {
  return join(orcaDir(), 'build-web-credential.enc')
}

function readMetadata(): BuildWebStoredMetadata | null {
  if (!existsSync(metadataPath())) {
    return null
  }
  try {
    const value = recordOf(JSON.parse(readFileSync(metadataPath(), 'utf-8')))
    if (!value || typeof value.baseUrl !== 'string' || typeof value.login !== 'string') {
      return null
    }
    return {
      version: 1,
      baseUrl: value.baseUrl,
      login: value.login,
      perms: textsOf(value.perms),
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : ''
    }
  } catch {
    return null
  }
}

export function getStoredBuildWebMetadata(): BuildWebStoredMetadata | null {
  if (!metadataLoaded) {
    cachedMetadata = readMetadata()
    metadataLoaded = true
  }
  return cachedMetadata
}

/** Never decrypts: safe on every status poll. */
export function hasStoredBuildWebCredential(): boolean {
  return getStoredBuildWebMetadata() !== null && credentialFileHasContent(getBuildWebSecretPath())
}

/** Whether the token was already decrypted this session (reading it now asks nothing). */
export function isBuildWebTokenUnlocked(): boolean {
  return cachedSecret !== null
}

export function getBuildWebCredentialGeneration(): number {
  return credentialGeneration
}

export function getBuildWebCredentialError(): string | null {
  return credentialError
}

export function getBuildWebCredentialProtection(): SecretAtRestProtection | null {
  return readCredentialFileProtection(getBuildWebSecretPath())
}

/** The token for `baseUrl`, decrypting on first use. Throws CredentialDecryptionError. */
export function loadBuildWebToken(baseUrl: string): string | null {
  if (!cachedSecret) {
    if (!existsSync(getBuildWebSecretPath())) {
      return null
    }
    try {
      const raw = readStoredCredentialToken('Build Web', readFileSync(getBuildWebSecretPath()))
      if (!raw) {
        return null
      }
      const value = recordOf(JSON.parse(raw))
      if (!value || typeof value.token !== 'string' || typeof value.baseUrl !== 'string') {
        return null
      }
      cachedSecret = { token: value.token, baseUrl: value.baseUrl }
      credentialError = null
    } catch (error) {
      if (error instanceof CredentialDecryptionError) {
        credentialError = error.message
        throw error
      }
      return null
    }
  }
  return cachedSecret.baseUrl === baseUrl ? cachedSecret.token : null
}

export function saveBuildWebCredential(input: {
  baseUrl: string
  token: string
  login: string
  perms: string[]
}): void {
  if (!existsSync(orcaDir())) {
    mkdirSync(orcaDir(), { recursive: true })
  }
  const secret: BuildWebStoredSecret = { token: input.token, baseUrl: input.baseUrl }
  writeEncryptedCredential('Build Web', getBuildWebSecretPath(), JSON.stringify(secret))
  const metadata: BuildWebStoredMetadata = {
    version: 1,
    baseUrl: input.baseUrl,
    login: input.login,
    perms: input.perms,
    updatedAt: new Date().toISOString()
  }
  writeCredentialFileAtomic(metadataPath(), Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8'))
  cachedMetadata = metadata
  metadataLoaded = true
  cachedSecret = secret
  credentialError = null
  credentialGeneration++
}

// Why: a non-ENOENT unlink failure must surface — otherwise the token silently
// comes back on the next launch after the user disconnected.
export function clearBuildWebCredential(): void {
  try {
    for (const path of [getBuildWebSecretPath(), metadataPath()]) {
      try {
        unlinkSync(path)
      } catch (error) {
        if (!isMissingFileError(error)) {
          throw error
        }
      }
    }
  } finally {
    cachedMetadata = null
    metadataLoaded = true
    cachedSecret = null
    credentialError = null
    credentialGeneration++
  }
}

/** @internal - tests need a clean in-memory cache between cases. */
export function _resetBuildWebCredentialCache(): void {
  cachedMetadata = null
  metadataLoaded = false
  cachedSecret = null
  credentialError = null
}
