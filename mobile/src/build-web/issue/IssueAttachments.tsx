import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  ExternalLink,
  File,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  type LucideIcon
} from 'lucide-react-native'
import type { BuildWebIssueFile } from '../../../../src/shared/build-web-types'
import { BUILD_WEB_ISSUE_FILES_RUNTIME_CAPABILITY } from '../../../../src/shared/build-web-capability'
import { openExternalLink } from '../../platform/external-link'
import { colors, radii, spacing, typography } from '../../theme/mobile-theme'
import { useBuildWebScreen } from '../build-web-screen-context'
import { formatBytes, issueAttachmentKind, issueFileConsoleUrl } from './issue-attachment-kind'
import { IssueAttachmentSheet } from './IssueAttachmentSheet'

function iconOf(file: BuildWebIssueFile): LucideIcon {
  if (file.mime.startsWith('image/')) {
    return FileImage
  }
  if (file.mime.startsWith('video/')) {
    return FileVideo
  }
  if (/\.html?$/i.test(file.name)) {
    return FileCode
  }
  return /\.(md|markdown|txt|log|pdf|docx)$/i.test(file.name) ? FileText : File
}

/**
 * Files of the task or of one comment. Pictures, Markdown, HTML and text open in a sheet here;
 * anything else, or anything too large, opens at the console in the browser.
 */
export function IssueAttachments({
  issueId,
  files
}: {
  issueId: string
  files: readonly BuildWebIssueFile[]
}) {
  const { status, hostCapabilities, notify } = useBuildWebScreen()
  const [shown, setShown] = useState<BuildWebIssueFile | null>(null)
  if (files.length === 0) {
    return null
  }
  const readable = hostCapabilities.includes(BUILD_WEB_ISSUE_FILES_RUNTIME_CAPABILITY)
  const openInBrowser = (file: BuildWebIssueFile) => {
    if (status.baseUrl) {
      openExternalLink(issueFileConsoleUrl(status.baseUrl, issueId, file.id))
    } else {
      notify('This Orca server does not open task attachments yet. Update the server.', 'error')
    }
  }
  return (
    <View style={styles.list} accessibilityLabel="Attachments">
      {files.map((file) => {
        const Icon = iconOf(file)
        const external = issueAttachmentKind(file) === 'browser' || !readable
        return (
          <Pressable
            key={file.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${file.name}`}
            onPress={() => (external ? openInBrowser(file) : setShown(file))}
            style={({ pressed }) => [styles.file, pressed ? styles.pressed : null]}
          >
            <Icon size={14} color={colors.textSecondary} />
            <Text style={styles.name} numberOfLines={1}>
              {file.name}
            </Text>
            <Text style={styles.size}>{formatBytes(file.size)}</Text>
            {external ? <ExternalLink size={12} color={colors.textMuted} /> : null}
          </Pressable>
        )
      })}
      <IssueAttachmentSheet issueId={issueId} file={shown} onClose={() => setShown(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    maxWidth: '100%',
    minHeight: 32,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgBase
  },
  pressed: { opacity: 0.7 },
  name: { flexShrink: 1, color: colors.textPrimary, fontSize: typography.metaSize },
  size: { color: colors.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] }
})
