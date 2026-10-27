import { StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import type { BuildWebNoticeTone } from './build-web-screen-context'

export type BuildWebNotice = { message: string; tone: BuildWebNoticeTone }

const TONE_COLORS: Record<BuildWebNoticeTone, string> = {
  info: colors.textPrimary,
  success: colors.statusGreen,
  error: colors.statusRed
}

export function BuildWebNoticeBanner({
  notice,
  bottomInset
}: {
  notice: BuildWebNotice | null
  bottomInset: number
}) {
  if (!notice) {
    return null
  }
  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { bottom: bottomInset + spacing.lg }]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.banner}>
        <Text style={[styles.text, { color: TONE_COLORS[notice.tone] }]}>{notice.message}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  banner: {
    backgroundColor: colors.bgRaised,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  text: { fontSize: typography.bodySize }
})
