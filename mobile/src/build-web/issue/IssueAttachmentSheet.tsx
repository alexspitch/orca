import { useEffect, useState } from 'react'
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { ExternalLink } from 'lucide-react-native'
import type { BuildWebIssueFile } from '../../../../src/shared/build-web-types'
import { BottomDrawer } from '../../components/BottomDrawer'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { MobileHtmlPreview } from '../../components/MobileHtmlPreview'
import { MobileMarkdown } from '../../components/MobileMarkdown'
import { openExternalLink } from '../../platform/external-link'
import { colors, radii, spacing, typography } from '../../theme/mobile-theme'
import { buildWebErrorMessage, callBuildWeb } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'
import { issueAttachmentKind, issueFileConsoleUrl, utf8OfBase64 } from './issue-attachment-kind'
import { CardButton, ErrorText, ui } from './issue-card-ui'

type Read = { fileId: string; mime: string; base64: string } | { fileId: string; error: string }

/** A task's file read through the host and shown here: a picture, Markdown, HTML or plain text. */
export function IssueAttachmentSheet({
  issueId,
  file,
  onClose
}: {
  issueId: string
  /** Null when closed. */
  file: BuildWebIssueFile | null
  onClose: () => void
}) {
  const { client, status } = useBuildWebScreen()
  const { height } = useWindowDimensions()
  const [read, setRead] = useState<Read | null>(null)
  const fileId = file?.id ?? null
  useEffect(() => {
    if (!fileId) {
      return
    }
    let alive = true
    callBuildWeb(client, 'issueFile', { id: issueId, fileId }).then(
      (content) => alive && setRead({ fileId, ...content }),
      (failure) => alive && setRead({ fileId, error: buildWebErrorMessage(failure) })
    )
    return () => {
      alive = false
    }
  }, [client, fileId, issueId])
  const current = read && read.fileId === fileId ? read : null
  const baseUrl = status.baseUrl
  const body = () => {
    if (!file) {
      return null
    }
    if (!current) {
      return (
        <View style={styles.centered}>
          <LoadingSpinner size={18} color={colors.textMuted} />
        </View>
      )
    }
    if ('error' in current) {
      return <ErrorText>{`Could not open ${file.name}: ${current.error}`}</ErrorText>
    }
    const kind = issueAttachmentKind(file)
    if (kind === 'image') {
      return (
        <Image
          accessibilityLabel={file.name}
          resizeMode="contain"
          source={{ uri: `data:${current.mime || file.mime};base64,${current.base64}` }}
          style={[styles.image, { height: height * 0.6 }]}
        />
      )
    }
    const text = utf8OfBase64(current.base64)
    if (kind === 'markdown') {
      return <MobileMarkdown content={text} />
    }
    if (kind === 'html') {
      return (
        <View style={{ height: height * 0.65 }}>
          <MobileHtmlPreview html={text} renderSource={() => <SourceText text={text} />} />
        </View>
      )
    }
    return <SourceText text={text} />
  }
  return (
    <BottomDrawer visible={file !== null} onClose={onClose} contentScrollable>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={2}>
          {file?.name ?? ''}
        </Text>
        {baseUrl && file ? (
          <CardButton
            icon={ExternalLink}
            accessibilityLabel="Open in the browser"
            onPress={() => openExternalLink(issueFileConsoleUrl(baseUrl, issueId, file.id))}
          />
        ) : null}
      </View>
      {body()}
    </BottomDrawer>
  )
}

function SourceText({ text }: { text: string }) {
  return (
    <ScrollView horizontal style={styles.source}>
      <Text selectable style={[ui.body, ui.mono, styles.sourceText]}>
        {text}
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  title: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  centered: { paddingVertical: spacing.xl, alignItems: 'center' },
  image: { width: '100%', borderRadius: radii.row, backgroundColor: colors.bgBase },
  source: { borderRadius: radii.row, backgroundColor: colors.bgBase, padding: spacing.sm },
  sourceText: { fontSize: typography.metaSize }
})
