import { createPairedCredentialStore } from '../paired-credential-store'
import type { SecretAtRestProtection } from '../../shared/secret-at-rest-protection'
import { recordOf, textsOf } from './build-web-response-fields'

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

const store = createPairedCredentialStore<BuildWebStoredMetadata, BuildWebStoredSecret>({
  service: 'Build Web',
  fileStem: 'build-web-credential',
  parseMetadata: (raw) => {
    const value = recordOf(raw)
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
  },
  parseSecret: (raw) => {
    const value = recordOf(raw)
    return value && typeof value.token === 'string' && typeof value.baseUrl === 'string'
      ? { token: value.token, baseUrl: value.baseUrl }
      : null
  }
})

export const getBuildWebSecretPath = (): string => store.secretPath()
export const getStoredBuildWebMetadata = (): BuildWebStoredMetadata | null => store.metadata()
export const hasStoredBuildWebCredential = (): boolean => store.hasStored()
export const getBuildWebCredentialGeneration = (): number => store.generation()
export const getBuildWebCredentialError = (): string | null => store.error()
export const getBuildWebCredentialProtection = (): SecretAtRestProtection | null =>
  store.protection()

/** Whether the token was already decrypted this session (reading it now asks nothing). */
export const isBuildWebTokenUnlocked = (): boolean => store.loadSecret() !== null

/** The token for `baseUrl`, decrypting on first use. Throws CredentialDecryptionError. */
export function loadBuildWebToken(baseUrl: string): string | null {
  const secret = store.loadSecret({ force: true })
  return secret?.baseUrl === baseUrl ? secret.token : null
}

export function saveBuildWebCredential(input: {
  baseUrl: string
  token: string
  login: string
  perms: string[]
}): void {
  store.save(
    {
      version: 1,
      baseUrl: input.baseUrl,
      login: input.login,
      perms: input.perms,
      updatedAt: new Date().toISOString()
    },
    { token: input.token, baseUrl: input.baseUrl }
  )
}

export const clearBuildWebCredential = (): void => store.clear()

/** @internal - tests need a clean in-memory cache between cases. */
export const _resetBuildWebCredentialCache = (): void => store.resetCache()
