import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { X } from 'lucide-react-native'
import type { BuildWebRun } from '../../../../src/shared/build-web-run-types'
import type { BuildWebPushProgress } from '../../../../src/shared/build-web-image-types'
import {
  isBuildGoing,
  trackedBuildsOf,
  areTwinsGoing,
  isPushOver,
  twinPushOf,
  versionOfBranch,
  type TrackedImageBuild,
  type TrackedImagePush
} from '../../../../src/shared/build-web-image-tracking'
import { runStatusTone } from '../../../../src/renderer/src/components/build-web/build-web-tones'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { colors, radii, spacing, typography } from '../../theme/mobile-theme'
import { buildWebErrorMessage } from '../build-web-operations'
import { useBuildWebScreen } from '../build-web-screen-context'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { PushOutcomeChip, TwinPushChip, type OpenImageLog } from './image-cells'
import { useImageTracking } from './image-tracking'

const BUILD_POLL_MS = 3000

function CardHead({
  going,
  title,
  startedAt,
  onDismiss,
  children
}: {
  going: boolean
  title: string
  startedAt: number
  onDismiss: () => void
  children?: React.ReactNode
}) {
  return (
    <View style={styles.head}>
      {going ? <LoadingSpinner size={14} color={colors.textMuted} /> : null}
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.muted}>{new Date(startedAt).toLocaleTimeString()}</Text>
      {children}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hide"
        hitSlop={8}
        onPress={onDismiss}
      >
        <X size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  )
}

/** One started build, read every few seconds until each of its builds has an outcome. */
function BuildCard({
  run,
  active,
  onSettled,
  onOpenLog
}: {
  run: TrackedImageBuild
  active: boolean
  onSettled: () => void
  onOpenLog: OpenImageLog
}) {
  const { call } = useBuildWebScreen()
  const { dismissBuild } = useImageTracking()
  const [answer, setAnswer] = useState<BuildWebRun | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [beat, setBeat] = useState(0)
  const settled = useRef(false)
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled
  const builds = trackedBuildsOf(run, answer?.builds ?? [])
  const several = run.images.length > 1
  const name = several ? `${run.images.length} images` : run.images[0]
  const going =
    answer === undefined || builds.length === 0 || builds.some((b) => isBuildGoing(b.status))

  useEffect(() => {
    if (!going && answer !== undefined) {
      if (!settled.current) {
        settled.current = true
        onSettledRef.current()
      }
      return
    }
    if (!active) {
      return
    }
    let alive = true
    const timer = setTimeout(
      () => {
        call('getRun', { runId: run.runId })
          .then(
            (next) => {
              if (alive) {
                setAnswer(next)
                setError(null)
              }
            },
            (failure: unknown) => {
              if (alive) {
                setError(buildWebErrorMessage(failure))
              }
            }
          )
          // Why a beat of its own: a failed read leaves the answer as it was, and must still ask again.
          .finally(() => alive && setBeat((n) => n + 1))
      },
      beat === 0 ? 0 : BUILD_POLL_MS
    )
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [active, answer, beat, call, going, run.runId])

  return (
    <View style={styles.card}>
      <CardHead
        going={going}
        title={going ? `Building ${name}…` : `Build of ${name} finished`}
        startedAt={run.startedAt}
        onDismiss={() => dismissBuild(run.runId)}
      />
      {answer === null ? (
        <Text style={styles.muted}>build-web no longer has this build.</Text>
      ) : null}
      {builds.map((b) => (
        <View key={`${b.image}|${b.dist}|${b.branch}`} style={styles.line}>
          {several ? (
            <Text style={styles.mono} numberOfLines={1}>
              {b.image}
            </Text>
          ) : null}
          <Text style={styles.small}>{b.dist}</Text>
          <BuildWebToneChip label={versionOfBranch(b.branch)} tone={null} mono />
          <View style={styles.inline}>
            {isBuildGoing(b.status) ? <LoadingSpinner size={12} color={colors.textMuted} /> : null}
            <BuildWebToneChip label={b.status} tone={runStatusTone(b.status)} />
          </View>
          {b.url ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => b.url && onOpenLog(b.url, `${b.image} (${b.dist}) #${b.number ?? ''}`)}
            >
              <Text style={styles.link}>#{b.number ?? '—'}</Text>
            </Pressable>
          ) : null}
          {b.error ? <Text style={styles.error}>{b.error}</Text> : null}
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

function pushHeadline(push: TrackedImagePush, progress: BuildWebPushProgress | undefined): string {
  if (!isPushOver(progress)) {
    return `Pushing ${push.keys.length} image(s)…`
  }
  if (progress?.state === 'unknown') {
    return 'build-web did not report this push; the table shows what the registry holds'
  }
  const finished = `Push finished: ${progress?.ok.length ?? 0} pushed, ${progress?.failed.length ?? 0} failed`
  return areTwinsGoing(progress) ? `${finished} · redos being made and pushed…` : finished
}

function PushCard({
  push,
  progress
}: {
  push: TrackedImagePush
  progress: BuildWebPushProgress | undefined
}) {
  const { dismissPush } = useImageTracking()
  const [showLog, setShowLog] = useState(false)
  const lines = progress?.lines ?? []
  const going = !isPushOver(progress) || areTwinsGoing(progress)
  return (
    <View style={styles.card}>
      <CardHead
        going={going}
        title={pushHeadline(push, progress)}
        startedAt={push.startedAt}
        onDismiss={() => dismissPush(push.runId)}
      >
        {lines.length ? (
          <Pressable accessibilityRole="button" hitSlop={6} onPress={() => setShowLog((v) => !v)}>
            <Text style={styles.link}>{showLog ? 'Hide log' : 'Log'}</Text>
          </Pressable>
        ) : null}
      </CardHead>
      {push.keys.map((key) => {
        const [image, dist] = key.split('|')
        const twin = twinPushOf(progress, key)
        return (
          <View key={key} style={styles.line}>
            <Text style={styles.mono} numberOfLines={1}>
              {image}
            </Text>
            <Text style={styles.small}>{dist}</Text>
            <PushOutcomeChip pushKey={key} progress={progress} />
            {twin ? <TwinPushChip twin={twin} /> : null}
          </View>
        )
      })}
      {going && lines.length && !showLog ? (
        <Text style={styles.logTail} numberOfLines={1}>
          {lines.at(-1)}
        </Text>
      ) : null}
      {showLog ? (
        <ScrollView style={styles.log} nestedScrollEnabled>
          <Text selectable style={styles.logText}>
            {lines.join('\n')}
          </Text>
        </ScrollView>
      ) : null}
      {progress?.error ? <Text style={styles.error}>{progress.error}</Text> : null}
    </View>
  )
}

/** The builds and pushes started from this screen — for one image, or all of them — newest first. */
export function ImageRunCards({
  image,
  active,
  onSettled,
  onOpenLog
}: {
  image?: string
  active: boolean
  onSettled: () => void
  onOpenLog: OpenImageLog
}) {
  const { builds, pushes } = useImageTracking()
  const runs = image ? builds.filter((r) => r.images.includes(image)) : builds
  const shownPushes = image
    ? pushes.pushes.filter((p) => p.keys.some((k) => k.startsWith(`${image}|`)))
    : pushes.pushes
  if (runs.length === 0 && shownPushes.length === 0) {
    return null
  }
  return (
    <View style={styles.cards}>
      {runs.map((run) => (
        <BuildCard
          key={run.runId}
          run={run}
          active={active}
          onSettled={onSettled}
          onOpenLog={onOpenLog}
        />
      ))}
      {shownPushes.map((push) => (
        <PushCard key={push.runId} push={push} progress={pushes.progress[push.runId]} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  cards: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  card: {
    gap: spacing.xs + 2,
    padding: spacing.sm + 2,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '600'
  },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  muted: { color: colors.textMuted, fontSize: typography.metaSize },
  small: { color: colors.textSecondary, fontSize: typography.metaSize },
  mono: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize
  },
  link: {
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    textDecorationLine: 'underline'
  },
  error: { color: colors.statusRed, fontSize: typography.metaSize },
  logTail: { color: colors.textMuted, fontFamily: typography.monoFamily, fontSize: 11 },
  log: { maxHeight: 192, borderRadius: radii.row, backgroundColor: colors.bgBase },
  logText: {
    padding: spacing.sm,
    color: colors.textSecondary,
    fontFamily: typography.monoFamily,
    fontSize: 11
  }
})
