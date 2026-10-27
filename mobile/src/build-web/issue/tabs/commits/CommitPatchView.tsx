import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  mobileDiffLineNumber,
  mobileDiffLinePrefix
} from '../../../../source-control/mobile-diff-format'
import { colors, radii, spacing, typography } from '../../../../theme/mobile-theme'
import { commitPatchFiles, type CommitPatchLine } from './commit-patch-files'

// Why a cap: thousands of wrapped rows freeze a phone; the server already cuts a huge patch.
const MAX_SHOWN_LINES = 2000

function PatchLine({ line }: { line: CommitPatchLine }) {
  if (line.kind === 'hunk') {
    return (
      <Text selectable style={[styles.code, styles.hunk]}>
        {line.text}
      </Text>
    )
  }
  return (
    <View
      style={[
        styles.row,
        line.kind === 'add' && styles.added,
        line.kind === 'delete' && styles.deleted
      ]}
    >
      <Text style={styles.gutter}>{mobileDiffLinePrefix(line.kind)}</Text>
      <Text style={[styles.gutter, styles.number]}>{mobileDiffLineNumber(line)}</Text>
      <Text selectable style={[styles.code, styles.text]}>
        {line.text}
      </Text>
    </View>
  )
}

/** A commit's files, one shown at a time, its lines removed-over-added. */
export function CommitPatchView({ patch, truncated }: { patch: string; truncated: boolean }) {
  const files = useMemo(() => commitPatchFiles(patch), [patch])
  const [fileIndex, setFileIndex] = useState(0)
  const file = files[fileIndex] ?? null
  return (
    <View style={styles.view}>
      <View style={styles.files}>
        {files.map((f, n) => (
          <Pressable
            key={`${f.path}-${n}`}
            style={[styles.file, n === fileIndex && styles.fileActive]}
            onPress={() => setFileIndex(n)}
            accessibilityRole="button"
            accessibilityState={{ selected: n === fileIndex }}
          >
            <Text style={styles.filePath}>
              {f.path}{' '}
              <Text style={styles.muted}>
                +{f.added} −{f.removed}
              </Text>
            </Text>
          </Pressable>
        ))}
      </View>
      {truncated ? (
        <Text style={styles.note}>
          The patch is long and was cut; open the commit in build-web for all of it.
        </Text>
      ) : null}
      {file ? (
        <ScrollView style={styles.lines} nestedScrollEnabled>
          {file.lines.slice(0, MAX_SHOWN_LINES).map((line, n) => (
            <PatchLine key={n} line={line} />
          ))}
          {file.lines.length > MAX_SHOWN_LINES ? (
            <Text style={styles.note}>
              Showing the first {MAX_SHOWN_LINES} of {file.lines.length} lines.
            </Text>
          ) : null}
        </ScrollView>
      ) : (
        <Text style={styles.note}>No file changes.</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  view: {
    gap: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden'
  },
  files: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  file: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.button },
  fileActive: { backgroundColor: colors.bgRaised },
  filePath: {
    color: colors.textPrimary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize
  },
  muted: { color: colors.textMuted },
  note: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  lines: { maxHeight: 640 },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle
  },
  added: { backgroundColor: colors.diffAddedBg },
  deleted: { backgroundColor: colors.diffDeletedBg },
  gutter: {
    width: 18,
    textAlign: 'center',
    color: colors.textMuted,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize,
    lineHeight: 18
  },
  number: { width: 40, textAlign: 'right', paddingRight: spacing.xs },
  code: { fontFamily: typography.monoFamily, fontSize: 12, lineHeight: 18 },
  text: { flex: 1, minWidth: 0, paddingHorizontal: spacing.sm, color: colors.textPrimary },
  hunk: {
    paddingHorizontal: spacing.sm,
    color: colors.textMuted,
    backgroundColor: colors.bgPanel
  }
})
