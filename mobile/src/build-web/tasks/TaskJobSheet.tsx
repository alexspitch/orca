import { StyleSheet, Text, View } from 'react-native'
import type { BuildWebConsoleTask } from '../../../../src/shared/build-web-activity-types'
import { BottomDrawer } from '../../components/BottomDrawer'
import { colors, spacing, typography } from '../../theme/mobile-theme'
import { GuideJobPanel } from '../issue/tabs/guide/GuideJobPanel'

/** A console job from the task list — a stand's, a guide's — as its live log, over the list. */
export function TaskJobSheet({
  task,
  onClose
}: {
  task: BuildWebConsoleTask | null
  onClose: () => void
}) {
  return (
    <BottomDrawer visible={task !== null} onClose={onClose} fillAvailable>
      {task ? (
        <View style={styles.body}>
          <Text style={styles.title}>{task.title}</Text>
          {task.detail ? <Text style={styles.detail}>{task.detail}</Text> : null}
          <GuideJobPanel
            key={task.id}
            jobId={task.id}
            label={task.kind}
            onJob={() => {}}
            onDone={() => {}}
          />
        </View>
      ) : null}
    </BottomDrawer>
  )
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: spacing.sm, padding: spacing.md },
  title: { color: colors.textPrimary, fontSize: typography.bodySize, fontWeight: '600' },
  detail: { color: colors.textSecondary, fontSize: typography.metaSize }
})
