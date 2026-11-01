import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ExternalLink } from 'lucide-react-native'
import type { BuildWebRecap } from '../../../../src/shared/build-web-recap-types'
import {
  recapReportedAt,
  recapWindowLabel
} from '../../../../src/renderer/src/components/build-web/recaps/recap-window'
import { htmlPreviewWithInertLinks } from '../../components/html-preview-inert-links'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { MobileLoadErrorState } from '../../components/MobileLoadErrorState'
import {
  MOBILE_HTML_PREVIEW_SANDBOX,
  MOBILE_HTML_PREVIEW_SEALED_SANDBOX
} from '../../components/MobileHtmlPreview'
import { useHtmlPreviewLinkGrant } from '../../components/use-html-preview-link-grant'
import { openExternalLink } from '../../platform/external-link'
import { colors, spacing, typography } from '../../theme/mobile-theme'
import { buildWebErrorMessage } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'
import { findIssueByKey } from '../find-issue-by-key'
import { FilterPill } from '../list/list-controls'
import { ProductChip } from '../BuildWebToneChip'
import { useRecapReport } from './use-recap-report'

/**
 * One report over the list. It draws in a frame that runs nothing, as every HTML preview on the
 * phone; its task numbers sit above it to open, and the browser shows it whole, charts included.
 */
export function RecapReportView({
  recap,
  onOpenIssue
}: {
  recap: BuildWebRecap
  onOpenIssue: (issueId: string) => void
}) {
  const { call, status, notify } = useBuildWebScreen()
  const { report, error, retry } = useRecapReport(recap.id)
  const linksOpen = useHtmlPreviewLinkGrant()
  const html = useMemo(
    () => (report ? (linksOpen ? report.html : htmlPreviewWithInertLinks(report.html)) : null),
    [linksOpen, report]
  )
  // The console serves the report itself, sandboxed, to a browser signed in to it.
  const consoleUrl = status.baseUrl
    ? `${status.baseUrl}/api/automations/runs/${encodeURIComponent(recap.id)}/report`
    : null

  const openTask = (key: string) => {
    findIssueByKey(call, key)
      .then((issue) =>
        issue ? onOpenIssue(issue.id) : notify(`build-web has no task ${key}.`, 'error')
      )
      .catch((failure: unknown) => notify(buildWebErrorMessage(failure), 'error'))
  }

  const windowLabel = recapWindowLabel(recap)
  const reportedAt = new Date(recapReportedAt(recap))
  const facts = [
    windowLabel ? `window ${windowLabel}` : '',
    recap.version?.name,
    Number.isNaN(reportedAt.getTime()) ? '' : reportedAt.toLocaleString()
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <View style={styles.root}>
      <View style={styles.bar}>
        <View style={styles.grow}>
          <View style={styles.heading}>
            <ProductChip product={recap.product} />
            <Text style={styles.title} numberOfLines={1}>
              {recap.name}
            </Text>
          </View>
          {facts ? (
            <Text style={styles.muted} numberOfLines={1}>
              {facts}
            </Text>
          ) : null}
        </View>
        {consoleUrl ? (
          <Pressable
            style={styles.iconButton}
            onPress={() => openExternalLink(consoleUrl)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open the report in the browser"
          >
            <ExternalLink size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {report && report.taskKeys.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.keysBar}>
          <View style={styles.keys}>
            {report.taskKeys.map((key) => (
              <FilterPill
                key={key}
                label={key}
                accessibilityLabel={`Open task ${key}`}
                onPress={() => openTask(key)}
              />
            ))}
          </View>
        </ScrollView>
      ) : null}
      {error ? (
        <MobileLoadErrorState message={error} onRetry={retry} />
      ) : html === null ? (
        <View style={styles.centered}>
          <LoadingSpinner size={18} color={colors.textMuted} />
          <Text style={styles.muted}>Loading the report…</Text>
        </View>
      ) : (
        <View style={styles.grow}>
          <iframe
            // Why the key: a srcdoc swapped in place is a navigation; a new report is a new frame.
            key={recap.id}
            title={recap.name}
            sandbox={linksOpen ? MOBILE_HTML_PREVIEW_SANDBOX : MOBILE_HTML_PREVIEW_SEALED_SANDBOX}
            srcDoc={html}
            referrerPolicy="no-referrer"
            style={IFRAME_STYLE}
          />
        </View>
      )}
    </View>
  )
}

/** A DOM style, not a `StyleSheet` entry: this element is an `iframe` and not a react-native view. */
const IFRAME_STYLE = {
  border: 'none',
  width: '100%',
  height: '100%',
  // Why dark: the report follows the frame's colour scheme, and the app is dark.
  colorScheme: 'dark',
  backgroundColor: colors.bgBase
} as const

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  grow: { flex: 1, minWidth: 0, minHeight: 0 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  keysBar: {
    flexGrow: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  keys: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '500'
  },
  iconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  muted: { color: colors.textMuted, fontSize: typography.metaSize }
})
