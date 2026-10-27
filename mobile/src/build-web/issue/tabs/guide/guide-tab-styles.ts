import { StyleSheet } from 'react-native'
import { colors, radii, spacing, typography } from '../../../../theme/mobile-theme'

export const guideStyles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel,
    padding: spacing.md
  },
  heading: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.textPrimary, fontSize: typography.bodySize, fontWeight: '600' },
  body: { color: colors.textPrimary, fontSize: typography.bodySize },
  meta: { color: colors.textMuted, fontSize: typography.metaSize },
  small: { color: colors.textMuted, fontSize: 11 },
  danger: { color: colors.statusRed, fontSize: typography.metaSize },
  success: { color: colors.statusGreen, fontSize: typography.metaSize },
  link: { color: colors.accentBlue, fontSize: typography.metaSize },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  field: { gap: spacing.xs + 2 },
  input: {
    minHeight: 40,
    borderRadius: radii.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgBase,
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  code: { fontFamily: typography.monoFamily, fontSize: typography.metaSize },
  select: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgBase,
    paddingHorizontal: spacing.md
  },
  selectInvalid: { borderColor: colors.statusRed },
  selectText: { flex: 1, color: colors.textPrimary, fontSize: typography.bodySize },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radii.row,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.statusRed,
    padding: spacing.sm + 2
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.row,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderSubtle,
    padding: spacing.lg
  },
  log: {
    maxHeight: 256,
    borderRadius: radii.row,
    backgroundColor: colors.bgRaised,
    padding: spacing.sm
  },
  logText: { color: colors.textSecondary, fontFamily: typography.monoFamily, fontSize: 11 },
  centered: { textAlign: 'center' }
})
