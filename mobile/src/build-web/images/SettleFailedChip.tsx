import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import type { BuildWebImageBuild } from '../../../../src/shared/build-web-image-types'
import { imageBuildTone } from '../../../../src/renderer/src/components/build-web/build-web-tones'
import { ConfirmModal } from '../../components/ConfirmModal'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { colors } from '../../theme/mobile-theme'
import { buildWebErrorMessage } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { buildStatusLabel, formatBuildTime } from './image-cells'

/**
 * The «failed» of an image whose release line has built before: a press offers that build in the
 * failed one's place. The console rewrites the runs that hold the failure; nothing is built.
 */
export function SettleFailedChip({
  failed,
  success,
  onSettled
}: {
  failed: BuildWebImageBuild
  success: BuildWebImageBuild
  onSettled: () => void
}) {
  const { call, notify } = useBuildWebScreen()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const to = success.number
  const build = [`#${to}`, success.tag, formatBuildTime(success.at)].filter(Boolean).join(' · ')

  const settle = async (): Promise<void> => {
    setAsking(false)
    setBusy(true)
    try {
      const result = await call('adoptImageSuccess', {
        image: failed.image,
        dist: failed.dist,
        number: failed.number,
        to
      })
      if (!result.ok) {
        notify(
          result.routeMissing
            ? 'This build-web console cannot do that yet. Update the console.'
            : result.error,
          'error'
        )
        return
      }
      notify(`${failed.image} on ${failed.dist} now names build #${to}.`, 'success')
      onSettled()
    } catch (failure) {
      notify(buildWebErrorMessage(failure), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${failed.raw_status} — use the last successful build #${to} instead, without building`}
        disabled={busy}
        hitSlop={6}
        onPress={() => setAsking(true)}
        style={styles.row}
      >
        {busy ? <LoadingSpinner size={12} color={colors.textMuted} /> : null}
        <View style={busy ? styles.busy : null}>
          <BuildWebToneChip label={buildStatusLabel('failed')} tone={imageBuildTone('failed')} />
        </View>
      </Pressable>
      <ConfirmModal
        visible={asking}
        title={`Use build #${to} of ${failed.image}?`}
        message={`Failed build #${failed.number} on ${failed.dist} is replaced, in this table and in the runs that hold it, by the newest successful build of the same version: ${build}. Nothing is built.`}
        confirmLabel={`Use #${to}`}
        onConfirm={() => void settle()}
        onCancel={() => setAsking(false)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  busy: { opacity: 0.6 }
})
