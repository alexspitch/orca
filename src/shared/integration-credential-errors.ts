export const INTEGRATION_CREDENTIAL_SERVICES = ['Linear', 'Jira', 'Bitbucket', 'Build Web'] as const

export type IntegrationCredentialService = (typeof INTEGRATION_CREDENTIAL_SERVICES)[number]

export function credentialDecryptionMessage(service: IntegrationCredentialService): string {
  return `Could not decrypt saved ${service} credential. Approve Keychain access or reconnect ${service}.`
}

// Why: decrypt errors cross IPC/RPC boundaries where only the message
// survives serialization, so detection matches on the canonical message.
export function isIntegrationCredentialDecryptionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return INTEGRATION_CREDENTIAL_SERVICES.some((service) =>
    message.includes(credentialDecryptionMessage(service))
  )
}
