export const INTEGRATION_CREDENTIAL_SERVICES = ['Linear', 'Jira', 'Bitbucket', 'Build Web'] as const

export type IntegrationCredentialService = (typeof INTEGRATION_CREDENTIAL_SERVICES)[number]

export function credentialDecryptionMessage(service: IntegrationCredentialService): string {
  return `Could not decrypt saved ${service} credential. Approve Keychain access or reconnect ${service}.`
}

// IPC/RPC may preserve only error messages; detect the canonical decrypt-failure text.
export function isIntegrationCredentialDecryptionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return INTEGRATION_CREDENTIAL_SERVICES.some((service) =>
    message.includes(credentialDecryptionMessage(service))
  )
}
