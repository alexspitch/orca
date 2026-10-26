import type { BitbucketAuthMode } from '../../shared/bitbucket-credentials'
import type { SecretAtRestProtection } from '../../shared/secret-at-rest-protection'
import { createPairedCredentialStore } from '../paired-credential-store'

// Plaintext display metadata lets status reads avoid keychain prompts.
export type BitbucketStoredMetadata = {
  version: 1
  authMode: BitbucketAuthMode
  email: string | null
  baseUrl: string | null
  account: string | null
  updatedAt: string
}

// Envelope auth fields prevent torn identity/secret pairs; optional fields support legacy files.
export type BitbucketStoredSecret = {
  accessToken: string | null
  apiToken: string | null
  authMode?: BitbucketAuthMode
  email?: string | null
  baseUrl?: string | null
}

export type BitbucketCredentialSaveInput = {
  authMode: BitbucketAuthMode
  email: string | null
  baseUrl: string | null
  account: string | null
  accessToken: string | null
  apiToken: string | null
}

function fieldsOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null
}

function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function authModeOf(value: unknown): BitbucketAuthMode | null {
  return value === 'token' || value === 'basic' ? value : null
}

const store = createPairedCredentialStore<BitbucketStoredMetadata, BitbucketStoredSecret>({
  service: 'Bitbucket',
  fileStem: 'bitbucket-credential',
  parseMetadata: (raw) => {
    const parsed = fieldsOf(raw)
    const authMode = authModeOf(parsed?.authMode)
    if (!parsed || !authMode) {
      return null
    }
    return {
      version: 1,
      authMode,
      email: asOptionalString(parsed.email),
      baseUrl: asOptionalString(parsed.baseUrl),
      account: asOptionalString(parsed.account),
      updatedAt: asOptionalString(parsed.updatedAt) ?? ''
    }
  },
  parseSecret: (raw) => {
    const parsed = fieldsOf(raw) ?? {}
    const authMode = authModeOf(parsed.authMode)
    return {
      accessToken: asOptionalString(parsed.accessToken),
      apiToken: asOptionalString(parsed.apiToken),
      ...(authMode ? { authMode } : {}),
      email: asOptionalString(parsed.email),
      baseUrl: asOptionalString(parsed.baseUrl)
    }
  }
})

export function getSecretPath(): string {
  return store.secretPath()
}

export function getStoredBitbucketMetadata(): BitbucketStoredMetadata | null {
  return store.metadata()
}

// Presence checks must avoid keychain prompts.
export function hasStoredBitbucketCredential(): boolean {
  return store.hasStored()
}

export function getStoredBitbucketCredentialError(): string | null {
  return store.error()
}

// Without force, read memory only; forced decryption can throw CredentialDecryptionError.
export function loadStoredBitbucketSecret(
  options: { force?: boolean } = {}
): BitbucketStoredSecret | null {
  return store.loadSecret(options)
}

export function getBitbucketCredentialProtection(): SecretAtRestProtection | null {
  return store.protection()
}

export function saveBitbucketCredential(input: BitbucketCredentialSaveInput): void {
  store.save(
    {
      version: 1,
      authMode: input.authMode,
      email: input.email,
      baseUrl: input.baseUrl,
      account: input.account,
      updatedAt: new Date().toISOString()
    },
    {
      accessToken: input.accessToken,
      apiToken: input.apiToken,
      authMode: input.authMode,
      email: input.email,
      baseUrl: input.baseUrl
    }
  )
}

// Surface failed deletes so credentials cannot silently reappear on relaunch.
export function clearStoredBitbucketCredential(): void {
  store.clear()
}

/** @internal - tests need a clean in-memory cache between cases. */
export function _resetBitbucketCredentialCache(): void {
  store.resetCache()
}
