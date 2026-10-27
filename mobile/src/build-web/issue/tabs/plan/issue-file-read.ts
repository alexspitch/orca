import {
  BUILD_WEB_ISSUE_FILES_RUNTIME_CAPABILITY,
  BUILD_WEB_ISSUE_MOCKUPS_RUNTIME_CAPABILITY
} from '../../../../../../src/shared/build-web-capability'
import { decodeBase64Bytes } from '../../../../transport/base64-byte-codec'

// The desktop client's refusals for the attachment calls an older host does not know.
export const ISSUE_FILES_REFUSAL =
  'This Orca server does not open task attachments yet. Update the server.'
export const ISSUE_MOCKUPS_REFUSAL =
  'This Orca server does not show task artifacts yet. Update the server.'

export const canReadIssueFiles = (capabilities: readonly string[]) =>
  capabilities.includes(BUILD_WEB_ISSUE_FILES_RUNTIME_CAPABILITY)
export const canViewIssueMockups = (capabilities: readonly string[]) =>
  capabilities.includes(BUILD_WEB_ISSUE_MOCKUPS_RUNTIME_CAPABILITY)

export const utf8OfBase64 = (base64: string) => new TextDecoder().decode(decodeBase64Bytes(base64))
