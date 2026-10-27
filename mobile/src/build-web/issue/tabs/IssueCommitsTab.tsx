import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { MobileLoadErrorState } from '../../../components/MobileLoadErrorState'
import { colors, radii, spacing, typography } from '../../../theme/mobile-theme'
import type { BuildWebIssueTabProps } from '../../build-web-card-tabs'
import { CommitPatchView } from './commits/CommitPatchView'
import { useIssueCommits } from './commits/use-issue-commits'

function Loading() {
  return (
    <View style={styles.center}>
      <LoadingSpinner size={20} color={colors.textMuted} />
    </View>
  )
}

/** The commits with the task's key; one opened shows its files and diff in place of the list. */
export function IssueCommitsTab({ detail }: BuildWebIssueTabProps) {
  const commits = useIssueCommits(detail.id)
  const { list, error, fetching, load, sha, open, diff, diffError, retryDiff } = commits

  if (error) {
    return <MobileLoadErrorState message={error} onRetry={() => void load(false)} />
  }
  if (!list) {
    return <Loading />
  }
  const opened = sha ? list.commits.find((c) => c.sha === sha) : undefined
  if (sha) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.back} onPress={() => open(null)} accessibilityRole="button">
          <ChevronLeft size={16} color={colors.textPrimary} />
          <Text style={styles.backText}>Commits</Text>
        </Pressable>
        {opened ? (
          <View style={styles.commitHead}>
            <Text style={styles.subject}>{opened.subject}</Text>
            <Text style={styles.meta}>
              <Text style={styles.mono}>{opened.sha.slice(0, 9)}</Text> · {opened.author} ·{' '}
              {opened.branches.join(', ')}
            </Text>
          </View>
        ) : null}
        {diffError ? (
          <MobileLoadErrorState message={diffError} onRetry={retryDiff} />
        ) : !diff ? (
          <Loading />
        ) : (
          <CommitPatchView key={sha} patch={diff.diff} truncated={diff.truncated} />
        )}
      </ScrollView>
    )
  }
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Commits · {list.commits.length}</Text>
        <Pressable
          style={[styles.fetch, fetching && styles.disabled]}
          disabled={fetching}
          onPress={() => void load(true)}
          accessibilityRole="button"
        >
          <Text style={styles.fetchText}>{fetching ? 'Reading…' : 'Update from git'}</Text>
        </Pressable>
      </View>
      <Text style={styles.meta}>
        Branches come from the task’s release: its branch and every newer one, down to master. A
        change carried over by cherry-pick is shown once.
      </Text>
      {list.commits.length === 0 ? (
        <Text style={styles.empty}>No commits with the task’s key on these branches.</Text>
      ) : (
        <View style={styles.list}>
          {list.commits.map((c, n) => (
            <Pressable
              key={c.sha}
              style={({ pressed }) => [
                styles.commit,
                n > 0 && styles.divider,
                pressed && styles.pressed
              ]}
              onPress={() => open(c.sha)}
              accessibilityRole="button"
            >
              <Text style={styles.subject}>{c.subject}</Text>
              <Text style={styles.meta}>
                <Text style={styles.mono}>{c.sha.slice(0, 9)}</Text> · {c.author} ·{' '}
                {c.branches.join(', ')}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '600'
  },
  fetch: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  disabled: { opacity: 0.5 },
  fetchText: { color: colors.textPrimary, fontSize: typography.bodySize },
  meta: { color: colors.textSecondary, fontSize: typography.metaSize },
  mono: { fontFamily: typography.monoFamily },
  empty: { color: colors.textSecondary, fontSize: typography.bodySize },
  list: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden'
  },
  commit: { gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  pressed: { backgroundColor: colors.bgRaised },
  subject: { color: colors.textPrimary, fontSize: typography.bodySize },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    minHeight: 36,
    paddingRight: spacing.sm
  },
  backText: { color: colors.textPrimary, fontSize: typography.bodySize },
  commitHead: { gap: spacing.xs }
})
