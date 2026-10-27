import { Pressable, StyleSheet, Text, View } from 'react-native'
import type {
  BuildWebBuildFreshness,
  BuildWebLastBuilt
} from '../../../../../../src/shared/build-web-run-types'
import type { ChipTone } from '../../../../../../src/renderer/src/components/build-web/build-web-tones'
import {
  cellLabel,
  type Cell
} from '../../../../../../src/renderer/src/components/build-web/issue/build/run-cells'
import { LoadingSpinner } from '../../../../components/LoadingSpinner'
import { chipTones, colors, spacing, typography } from '../../../../theme/mobile-theme'
import { useBuildWebScreen } from '../../../build-web-screen-context'
import { BuildWebToneChip } from '../../../BuildWebToneChip'

// The chips of one image row, after build-web's Progress: its state, how it stands against its
// branch, and where it is in the registry. A tap says the reason the desktop keeps in a tooltip.

/** «2026-08-12 14:03» in the reader's own time zone. */
export function formatAt(iso: string | null): string | null {
  if (!iso) {
    return null
  }
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) {
    return null
  }
  const p = (n: number) => String(n).padStart(2, '0')
  return `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())} ${p(at.getHours())}:${p(at.getMinutes())}`
}

export function TipChip({
  label,
  tone,
  tip,
  onPress
}: {
  label: string
  tone: ChipTone | null
  tip: string
  /** Instead of saying the tip: the chip is also a control. */
  onPress?: () => void
}) {
  const { notify } = useBuildWebScreen()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={tip}
      hitSlop={4}
      onPress={onPress ?? (() => notify(tip))}
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      <BuildWebToneChip label={label} tone={tone} />
    </Pressable>
  )
}

function stateTone(cell: Cell): ChipTone | null {
  if (cell.state === 'pending') {
    return null
  }
  if (cell.state !== 'done') {
    return 'blue'
  }
  switch (cell.status ?? '') {
    case 'SUCCESS':
      return 'green'
    case 'FAILURE':
    case 'ERROR':
    case 'trigger-failed':
      return 'red'
    case 'ABORTED':
    case 'UNSTABLE':
      return 'amber'
    default:
      return null
  }
}

export function CellStateChip({ cell, now }: { cell: Cell; now: number }) {
  const live = cell.state === 'queued' || cell.state === 'building'
  return (
    <View style={styles.inline}>
      {live ? <LoadingSpinner size={12} color={chipTones.blue} /> : null}
      <BuildWebToneChip label={cellLabel(cell, now)} tone={stateTone(cell)} />
    </View>
  )
}

function lastBuiltLabel(state: BuildWebLastBuilt['state']): string {
  switch (state) {
    case 'up-to-date':
      return 'no changes'
    case 'changed':
      return 'changed'
    case 'never-built':
      return 'never built'
    case 'no-image':
      return 'no image'
    case 'unknown':
      return 'not built here'
  }
}

function lastBuiltTip(e: BuildWebLastBuilt): string {
  const n = String(e.build_number ?? '')
  switch (e.state) {
    case 'up-to-date':
      return `Nothing this image is built from changed since build #${n} — building it again would produce the same image`
    case 'changed':
      return `Changed since build #${n}: ${e.changed.join(', ') || 'its sources'}`
    case 'never-built':
      return 'This version has no CI build tag on this branch yet'
    case 'no-image':
      return `Nothing changed since build #${n}, but no image of it exists for ${e.dist} — that build made the other distribution`
    case 'unknown':
      return 'This branch does not build this image for this distribution'
  }
}

export function LastBuiltChips({ entry }: { entry: BuildWebLastBuilt }) {
  const tone: ChipTone | null =
    entry.state === 'up-to-date'
      ? 'green'
      : entry.state === 'changed' || entry.state === 'no-image'
        ? 'amber'
        : null
  return (
    <>
      {entry.build_number !== null ? (
        <Text style={styles.meta}>
          #{entry.build_number}
          {entry.built_at ? ` · ${entry.built_at.slice(0, 10)}` : ''}
          {entry.published === false ? ' (not in the registry)' : ''}
        </Text>
      ) : null}
      <TipChip label={lastBuiltLabel(entry.state)} tone={tone} tip={lastBuiltTip(entry)} />
    </>
  )
}

function freshnessTip(f: BuildWebBuildFreshness, ticket: string | null): string {
  const made = f.built_from === 'build-tag' ? 'built from a commit of' : 'triggered'
  const against = ticket ? `last commit of ${ticket}` : 'branch last commit'
  const verdict =
    f.state === 'current'
      ? 'at or after it — this image contains that commit'
      : 'before it — a newer commit is not in this image'
  const u = f.newer_unpublished
  const unpublished = u
    ? ` CI also made #${u.build_number}, which the registry does not serve.`
    : ''
  return `${made} ${formatAt(f.built_at) ?? '—'}, ${against} ${formatAt(f.ref_at) ?? '—'}: ${verdict}.${unpublished}`
}

export function FreshnessChip({
  freshness,
  ticket
}: {
  freshness: BuildWebBuildFreshness
  ticket: string | null
}) {
  if (freshness.state === 'unknown') {
    return null
  }
  const current = freshness.state === 'current'
  return (
    <TipChip
      label={current ? 'up to date' : 'needs rebuild'}
      tone={current ? 'green' : 'amber'}
      tip={freshnessTip(freshness, ticket)}
    />
  )
}

/** Where a built row stands in the registry; the unpublished ones open the push menu. */
export function RegistryChip({
  cell,
  pushing,
  menuDisabled,
  onOpenPush
}: {
  cell: Cell
  pushing: boolean
  menuDisabled: boolean
  onOpenPush: (cells: Cell[]) => void
}) {
  const { notify } = useBuildWebScreen()
  if (cell.state !== 'done' || cell.status !== 'SUCCESS') {
    return null
  }
  if (pushing && !cell.pushed) {
    return (
      <View style={styles.inline}>
        <LoadingSpinner size={12} color={chipTones.amber} />
        <BuildWebToneChip label="pushing…" tone="amber" />
      </View>
    )
  }
  if (cell.pushed && !cell.mainTagSkipped) {
    return <BuildWebToneChip label="pushed" tone="green" />
  }
  if (!cell.pushed && cell.tags.length === 0) {
    return null
  }
  const label = cell.pushed ? 'pushed (build tag only)' : 'not pushed'
  const tip = cell.pushed
    ? cell.skippedTags.length
      ? cell.skippedTags.map((s) => `${s.ref} — ${s.reason}`).join('\n')
      : 'Published under the build tag only — the moving tag was left pointing at a newer image already in the registry.'
    : 'Tap to choose what to publish'
  // Why: the console publishes a redos twin along with its rhel row, or by «Retry»; never by a push.
  if (cell.twin) {
    return (
      <TipChip
        label={label}
        tone="amber"
        tip={cell.pushed ? tip : 'redos goes out with its rhel row — or by «Retry» on this row'}
      />
    )
  }
  return (
    <TipChip
      label={label}
      tone="amber"
      tip={tip}
      onPress={() => {
        if (menuDisabled) {
          notify(tip)
          return
        }
        onOpenPush([cell])
      }}
    />
  )
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meta: { color: colors.textMuted, fontSize: 11, fontFamily: typography.monoFamily },
  pressed: { opacity: 0.7 }
})
