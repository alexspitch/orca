import { useState } from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native'
import { ExternalLink } from 'lucide-react-native'
import type { BuildWebIssueFile } from '../../../../../src/shared/build-web-types'
import {
  filesWithRole,
  followFile
} from '../../../../../src/renderer/src/components/build-web/issue/plan/issue-file-roles'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { MobileHtmlPreview } from '../../../components/MobileHtmlPreview'
import { openExternalLink } from '../../../platform/external-link'
import { colors, radii, spacing, typography } from '../../../theme/mobile-theme'
import type { BuildWebIssueTabProps } from '../../build-web-card-tabs'
import { IssueAttachHint } from './plan/IssueAttachHint'
import { useIssueMockup } from './plan/use-issue-mockup'

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * The task's mockups — a page, or an archive of pages. A page or picture is drawn here (a page's
 * scripts stay off, as every HTML preview on the phone); any screen opens live in the browser.
 */
export function IssueMockupsTab({ detail }: BuildWebIssueTabProps) {
  const mockups = filesWithRole(detail.files, 'mockup')
  const [picked, setPicked] = useState<Pick<BuildWebIssueFile, 'id' | 'name'> | null>(null)
  const chosen = followFile(mockups, picked)
  const [screen, setScreen] = useState<string | null>(null)
  const { view, viewError, preview, previewLoading, previewError } = useIssueMockup(
    detail.id,
    chosen
  )
  const { height } = useWindowDimensions()

  if (!chosen) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <IssueAttachHint
          text="The task has no artifacts. Attach a page or a zip of pages with"
          command={`bw.sh attach ${detail.key} <mockup.html|mockups.zip> --mockup`}
        />
      </ScrollView>
    )
  }
  const current = view?.screens.find((s) => s.path === screen) ?? view?.screens[0] ?? null
  const url = view && current ? `${view.base}${current.path}` : null
  const frameHeight = Math.max(360, Math.round(height * 0.65))
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {mockups.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chips}>
            {mockups.map((m) => (
              <Chip
                key={m.id}
                label={m.name}
                active={m.id === chosen.id}
                onPress={() => {
                  setPicked(m)
                  setScreen(null)
                }}
              />
            ))}
          </View>
        </ScrollView>
      ) : null}
      {view && view.screens.length > 1 ? (
        <View style={[styles.chips, styles.wrap]}>
          {view.screens.map((s) => (
            <Chip
              key={s.path}
              label={s.name.split('/').pop() ?? s.name}
              active={s.path === current?.path}
              onPress={() => setScreen(s.path)}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.bar}>
        <Text style={styles.name} numberOfLines={1}>
          {current?.name ?? chosen.name}
        </Text>
        <Pressable
          style={[styles.open, !url && styles.disabled]}
          disabled={!url}
          onPress={() => url && openExternalLink(url)}
          accessibilityRole="button"
        >
          <ExternalLink size={14} color={colors.textPrimary} />
          <Text style={styles.openText}>Open in browser</Text>
        </Pressable>
      </View>
      {viewError ? <Text style={styles.error}>{viewError}</Text> : null}
      {!viewError && !view ? <LoadingSpinner size={16} color={colors.textMuted} /> : null}
      {view && !url ? <Text style={styles.muted}>The archive holds no .html page.</Text> : null}
      {previewError ? <Text style={styles.error}>{previewError}</Text> : null}
      {previewLoading ? <LoadingSpinner size={16} color={colors.textMuted} /> : null}
      {preview?.kind === 'html' ? (
        <>
          <Text style={styles.muted}>
            Scripts do not run here; open it in the browser for the live page.
          </Text>
          <View style={[styles.frame, { height: frameHeight }]}>
            <MobileHtmlPreview
              html={preview.html}
              renderSource={() => (
                <ScrollView contentContainerStyle={styles.source}>
                  <Text selectable style={styles.sourceText}>
                    {preview.html}
                  </Text>
                </ScrollView>
              )}
            />
          </View>
        </>
      ) : null}
      {preview?.kind === 'image' ? (
        <Image
          source={{ uri: preview.uri }}
          style={[styles.image, { height: frameHeight }]}
          resizeMode="contain"
          accessibilityLabel={chosen.name}
        />
      ) : null}
      {!preview && !previewLoading && !previewError && url ? (
        <Text style={styles.muted}>Open a screen in the browser to see it.</Text>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.xs },
  wrap: { flexWrap: 'wrap' },
  chip: {
    maxWidth: 260,
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  chipActive: { backgroundColor: colors.bgRaised },
  chipText: {
    color: colors.textSecondary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize
  },
  chipTextActive: { color: colors.textPrimary },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: {
    flex: 1,
    minWidth: 0,
    color: colors.textSecondary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize
  },
  open: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.button
  },
  disabled: { opacity: 0.5 },
  openText: { color: colors.textPrimary, fontSize: typography.bodySize },
  error: { color: colors.statusRed, fontSize: typography.bodySize },
  muted: { color: colors.textSecondary, fontSize: typography.metaSize },
  frame: {
    overflow: 'hidden',
    borderRadius: radii.row,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  source: { padding: spacing.md },
  sourceText: {
    color: colors.textPrimary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize
  },
  image: { width: '100%', borderRadius: radii.row, backgroundColor: colors.bgPanel }
})
