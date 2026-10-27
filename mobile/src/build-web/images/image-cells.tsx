import { Pressable, StyleSheet, Text, View } from 'react-native'
import type {
  BuildWebImageBuild,
  BuildWebPushProgress
} from '../../../../src/shared/build-web-image-types'
import {
  isPushOver,
  pushStateOf,
  rowPushProgress
} from '../../../../src/shared/build-web-image-tracking'
import { imageBuildTone } from '../../../../src/renderer/src/components/build-web/build-web-tones'
import { imageRefOf } from '../../../../src/renderer/src/components/build-web/images/image-links'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { chipTones, colors, typography } from '../../theme/mobile-theme'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { useImageTracking } from './image-tracking'

// What the image list and an image's history both show of a build, so both read as one table.

export type OpenImageLog = (url: string, title: string) => void

export function buildStatusLabel(status: BuildWebImageBuild['status']): string {
  switch (status) {
    case 'success':
      return 'success'
    case 'failed':
      return 'failed'
    case 'running':
      return 'in progress'
  }
}

export function BuildStatusChip({ build }: { build: BuildWebImageBuild }) {
  return (
    <View style={styles.row} accessibilityLabel={build.raw_status}>
      {build.status === 'running' ? <LoadingSpinner size={12} color={chipTones.cyan} /> : null}
      <BuildWebToneChip
        label={buildStatusLabel(build.status)}
        tone={imageBuildTone(build.status)}
      />
    </View>
  )
}

function Going({ label }: { label: string }) {
  return (
    <View style={styles.row}>
      <LoadingSpinner size={12} color={chipTones.amber} />
      <BuildWebToneChip label={label} tone="amber" />
    </View>
  )
}

/** Where the build stands in the registry — build-web's «В repo»: pushed green, the rest amber. */
export function RegistryChip({ build }: { build: BuildWebImageBuild }) {
  // A push started from this screen says so until the table reads its outcome.
  const push = pushStateOf(useImageTracking().pushes, build)
  if (!imageRefOf(build)) {
    return null
  }
  if (push === 'pushing') {
    return <Going label="pushing…" />
  }
  if (push === 'failed') {
    return <BuildWebToneChip label="push failed" tone="red" />
  }
  if (build.pushed_build_tag && build.pushed_main_tag) {
    return <BuildWebToneChip label="pushed" tone="green" />
  }
  return (
    <BuildWebToneChip
      label={build.pushed_build_tag ? 'build tag only' : 'not pushed'}
      tone="amber"
    />
  )
}

/** One image's outcome in a push: pushed, failed, no answer once it ended, else still going. */
export function PushOutcomeChip({
  pushKey,
  progress
}: {
  pushKey: string
  progress: BuildWebPushProgress | undefined
}) {
  if (progress?.ok.includes(pushKey)) {
    return <BuildWebToneChip label="pushed" tone="green" />
  }
  if (progress?.failed.includes(pushKey)) {
    return <BuildWebToneChip label="push failed" tone="red" />
  }
  if (isPushOver(progress)) {
    return <BuildWebToneChip label="no answer" tone={null} />
  }
  return <Going label="pushing…" />
}

/** The row's registry: what a push going does to it while it goes, else what the registry holds. */
export function RowRegistryChip({ rowKey, build }: { rowKey: string; build: BuildWebImageBuild }) {
  const { going, progress } = rowPushProgress(useImageTracking().pushes, rowKey)
  return going ? (
    <PushOutcomeChip pushKey={rowKey} progress={progress} />
  ) : (
    <RegistryChip build={build} />
  )
}

export function LogLink({ build, onOpen }: { build: BuildWebImageBuild; onOpen: OpenImageLog }) {
  const url = build.url
  if (!url || !/^https?:\/\//.test(url)) {
    return null
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Build log #${build.number}`}
      hitSlop={6}
      onPress={() => onOpen(url, `${build.image} (${build.dist}) #${build.number}`)}
    >
      <Text style={styles.link}>#{build.number}</Text>
    </Pressable>
  )
}

export function formatBuildTime(at: string | null): string {
  if (!at) {
    return ''
  }
  const date = new Date(at)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  link: {
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    textDecorationLine: 'underline'
  }
})
