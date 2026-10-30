import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ChevronDown, ChevronRight, FileText, Folder } from 'lucide-react-native'
import {
  mobileDiffLineNumber,
  mobileDiffLinePrefix
} from '../../../../source-control/mobile-diff-format'
import { statusColor } from '../../../../source-control/mobile-source-control-screen-state'
import { colors, radii, spacing, typography } from '../../../../theme/mobile-theme'
import { commitTreeRows, firstFileIndexOf } from './commit-file-tree'
import { commitPatchFiles, type CommitPatchFile, type CommitPatchLine } from './commit-patch-files'

// Why a cap: thousands of wrapped rows freeze a phone; the server already cuts a huge patch.
const MAX_SHOWN_LINES = 2000
const INDENT = 12
const NO_FOLDERS: ReadonlySet<string> = new Set()

const statusTone = (status: CommitPatchFile['status']) =>
  statusColor(status === 'changed' ? 'modified' : status)

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

/** A commit's files as folders, one file shown at a time, its lines removed-over-added. Mount per commit. */
export function CommitPatchView({ patch, truncated }: { patch: string; truncated: boolean }) {
  const files = useMemo(() => commitPatchFiles(patch), [patch])
  const paths = useMemo(() => files.map((f) => f.path), [files])
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(NO_FOLDERS)
  const rows = useMemo(() => commitTreeRows(paths, collapsed), [paths, collapsed])
  // Why apart from rows: folding the first folder must not swap the file shown.
  const first = useMemo(() => firstFileIndexOf(commitTreeRows(paths, NO_FOLDERS)), [paths])
  const [fileIndex, setFileIndex] = useState<number | null>(null)
  const shownIndex = fileIndex ?? first
  const file = shownIndex === null ? null : (files[shownIndex] ?? null)
  const toggle = (key: string) =>
    setCollapsed((shown) => {
      const next = new Set(shown)
      if (!next.delete(key)) {
        next.add(key)
      }
      return next
    })
  return (
    <View style={styles.view}>
      {rows.length > 0 ? (
        <ScrollView style={styles.files} nestedScrollEnabled>
          {rows.map((row) =>
            row.kind === 'folder' ? (
              <Pressable
                key={`folder:${row.key}`}
                style={[styles.treeRow, { paddingLeft: spacing.sm + row.depth * INDENT }]}
                onPress={() => toggle(row.key)}
                accessibilityRole="button"
                accessibilityState={{ expanded: !collapsed.has(row.key) }}
              >
                {collapsed.has(row.key) ? (
                  <ChevronRight size={12} color={colors.textMuted} />
                ) : (
                  <ChevronDown size={12} color={colors.textMuted} />
                )}
                <Folder size={12} color={colors.textMuted} />
                <Text style={[styles.treeName, styles.muted]} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text style={styles.count}>{row.files}</Text>
              </Pressable>
            ) : (
              <Pressable
                key={`file:${row.key}`}
                style={[
                  styles.treeRow,
                  { paddingLeft: spacing.sm + INDENT + row.depth * INDENT },
                  row.index === shownIndex && styles.fileActive
                ]}
                onPress={() => setFileIndex(row.index)}
                accessibilityRole="button"
                accessibilityState={{ selected: row.index === shownIndex }}
              >
                <FileText size={12} color={statusTone(files[row.index]?.status ?? 'changed')} />
                <Text style={styles.treeName} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text style={styles.count}>
                  +{files[row.index]?.added ?? 0} −{files[row.index]?.removed ?? 0}
                </Text>
              </Pressable>
            )
          )}
        </ScrollView>
      ) : null}
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
    maxHeight: 320,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  treeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 32,
    paddingRight: spacing.sm
  },
  fileActive: { backgroundColor: colors.bgRaised },
  treeName: { flex: 1, minWidth: 0, color: colors.textPrimary, fontSize: typography.metaSize },
  count: { color: colors.textMuted, fontSize: typography.metaSize, fontVariant: ['tabular-nums'] },
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
