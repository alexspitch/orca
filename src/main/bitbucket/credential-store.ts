import type { BitbucketAuthMode } from '../../shared/bitbucket-credentials'
import type { SecretAtRestProtection } from '../../shared/secret-at-rest-protection'
import { createPairedCredentialStore } from '../paired-credential-store'

// Why: the secret stays encrypted via safeStorage while this metadata stays
// plaintext, so status reads render the connected account without decrypting —
// otherwise every Settings open would trigger an OS keychain prompt.
export type BitbucketStoredMetadata = {
  version: 1
  authMode: BitbucketAuthMode
  email: string | null
  baseUrl: string | null
  account: string | null
  updatedAt: string
}

// Why (STA-3941): the envelope carries everything auth needs, so a torn write
// between the two files can only leave stale display metadata — never a new
// secret paired with an old email that cannot authenticate. Fields are optional
// because credentials saved before this change hold only the two tokens.
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

// Why: hand-edited or truncated JSON must not put a non-string into an auth
// header, so every field is narrowed rather than trusted.
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

// Cheap "is a credential saved?" check: metadata present and a non-empty secret
// file. Never decrypts, so it is safe on every status poll.
export function hasStoredBitbucketCredential(): boolean {
  return store.hasStored()
}

export function getStoredBitbucketCredentialError(): string | null {
  return store.error()
}

// Cache-first; only touches the keychain when `force` is set and the secret is
// not already in memory (mirrors Linear's `loadToken({ force })`). Throws
// CredentialDecryptionError when ciphertext cannot be decrypted.
export function loadStoredBitbucketSecret(
  options: { force?: boolean } = {}
): BitbucketStoredSecret | null {
  return store.loadSecret(options)
}

/** How the stored Bitbucket secret sits on disk, or null when none is stored. */
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

// Why: swallowing a non-ENOENT unlink failure would clear memory while the
// files survive, so the credential silently returns on the next launch.
export function clearStoredBitbucketCredential(): void {
  store.clear()
}

/** @internal - tests need a clean in-memory cache between cases. */
export function _resetBitbucketCredentialCache(): void {
  store.resetCache()
}
