import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  CredentialDecryptionError,
  credentialFileHasContent,
  readStoredCredentialToken,
  writeCredentialFileAtomic,
  writeEncryptedCredential
} from './integration-credential-file'
import { readCredentialFileProtection } from './credential-file-protection'
import type { IntegrationCredentialService } from '../shared/integration-credential-errors'
import type { SecretAtRestProtection } from '../shared/secret-at-rest-protection'

// An integration credential kept as two files under ~/.orca: `<stem>.enc`, the secret encrypted
// with safeStorage, and `<stem>.json`, plaintext metadata. Why two: a status read names the
// account from the metadata without decrypting, so opening Settings never prompts the keychain.

export type PairedCredentialStore<Metadata, Secret> = {
  secretPath: () => string
  /** The metadata, read from disk once and then cached. Never decrypts. */
  metadata: () => Metadata | null
  /** Metadata present and a non-empty secret file. Never decrypts: safe on every poll. */
  hasStored: () => boolean
  /** The last decryption failure, until a save, clear or successful read. */
  error: () => string | null
  protection: () => SecretAtRestProtection | null
  /** Cache first; decrypts only with `force`. Throws CredentialDecryptionError. */
  loadSecret: (options?: { force?: boolean }) => Secret | null
  /** Bumped on every save and clear, so whatever was read under another secret can tell. */
  generation: () => number
  save: (metadata: Metadata, secret: Secret) => void
  /** A non-ENOENT unlink failure throws; the caches are dropped either way. */
  clear: () => void
  /** @internal - tests need a clean in-memory cache between cases. */
  resetCache: () => void
}

export function createPairedCredentialStore<Metadata, Secret>(config: {
  /** The service name the encrypted envelope and its errors carry. */
  service: IntegrationCredentialService
  fileStem: string
  parseMetadata: (value: unknown) => Metadata | null
  parseSecret: (value: unknown) => Secret | null
}): PairedCredentialStore<Metadata, Secret> {
  let cachedMetadata: Metadata | null = null
  let metadataLoaded = false
  let cachedSecret: Secret | null = null
  let credentialError: string | null = null
  let generation = 0

  const orcaDir = () => join(homedir(), '.orca')
  const metadataPath = () => join(orcaDir(), `${config.fileStem}.json`)
  const secretPath = () => join(orcaDir(), `${config.fileStem}.enc`)

  function readMetadata(): Metadata | null {
    if (!existsSync(metadataPath())) {
      return null
    }
    try {
      return config.parseMetadata(JSON.parse(readFileSync(metadataPath(), 'utf-8')))
    } catch {
      return null
    }
  }

  function metadata(): Metadata | null {
    if (!metadataLoaded) {
      cachedMetadata = readMetadata()
      metadataLoaded = true
    }
    return cachedMetadata
  }

  function dropCaches(): void {
    cachedMetadata = null
    metadataLoaded = true
    cachedSecret = null
    credentialError = null
  }

  return {
    secretPath,
    metadata,
    hasStored: () => metadata() !== null && credentialFileHasContent(secretPath()),
    error: () => credentialError,
    protection: () => readCredentialFileProtection(secretPath()),
    loadSecret: (options = {}) => {
      if (cachedSecret !== null || !options.force || !existsSync(secretPath())) {
        return cachedSecret
      }
      try {
        const raw = readStoredCredentialToken(config.service, readFileSync(secretPath()))
        cachedSecret = raw ? config.parseSecret(JSON.parse(raw)) : null
        credentialError = null
        return cachedSecret
      } catch (error) {
        if (error instanceof CredentialDecryptionError) {
          credentialError = error.message
          throw error
        }
        return null
      }
    },
    generation: () => generation,
    save: (nextMetadata, secret) => {
      if (!existsSync(orcaDir())) {
        mkdirSync(orcaDir(), { recursive: true })
      }
      writeEncryptedCredential(config.service, secretPath(), JSON.stringify(secret))
      writeCredentialFileAtomic(
        metadataPath(),
        Buffer.from(JSON.stringify(nextMetadata, null, 2), 'utf-8')
      )
      cachedMetadata = nextMetadata
      metadataLoaded = true
      cachedSecret = secret
      credentialError = null
      generation++
    },
    clear: () => {
      try {
        for (const path of [secretPath(), metadataPath()]) {
          try {
            unlinkSync(path)
          } catch (error) {
            if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
              throw error
            }
          }
        }
      } finally {
        // Why: on a partial delete the session must still stop using the disconnected secret.
        dropCaches()
        generation++
      }
    },
    resetCache: () => {
      dropCaches()
      metadataLoaded = false
    }
  }
}
