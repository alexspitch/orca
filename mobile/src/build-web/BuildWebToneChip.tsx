import { StyleSheet, Text, View } from 'react-native'
import type { BuildWebIssueProduct, BuildWebIssueStatus } from '../../../src/shared/build-web-types'
import {
  jiraStatusTone,
  priorityTone,
  productTone,
  statusTone,
  typeTone,
  type ChipTone
} from '../../../src/renderer/src/components/build-web/build-web-tones'
import { chipTones, colors, typography } from '../theme/mobile-theme'
import { priorityLabel, productLabel, statusLabel, typeLabel } from './build-web-labels'

// Text in the hue over the same hue at a fraction, as the desktop chip; no tone is a plain outline.
export function BuildWebToneChip({
  label,
  tone,
  mono
}: {
  label: string
  tone: ChipTone | null
  /** For a value read character by character: a release, a tag, a key. */
  mono?: boolean
}) {
  const hue = tone ? chipTones[tone] : null
  return (
    <View
      style={[
        styles.chip,
        hue
          ? { borderColor: `${hue}66`, backgroundColor: `${hue}26` }
          : { borderColor: colors.borderSubtle }
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.text, { color: hue ?? colors.textMuted }, mono ? styles.mono : null]}
      >
        {label}
      </Text>
    </View>
  )
}

export function StatusChip({ status }: { status: BuildWebIssueStatus }) {
  return <BuildWebToneChip label={statusLabel(status)} tone={statusTone(status)} />
}

export function PriorityChip({ priority }: { priority: number }) {
  return <BuildWebToneChip label={priorityLabel(priority)} tone={priorityTone(priority)} />
}

export function ProductChip({ product }: { product: BuildWebIssueProduct }) {
  return <BuildWebToneChip label={productLabel(product)} tone={productTone(product)} />
}

export function TypeChip({ type }: { type: string }) {
  return <BuildWebToneChip label={typeLabel(type)} tone={typeTone(type)} />
}

/** A Jira key and its status chip, coloured by the status name as build-web does. */
export function JiraStatusLine({ jiraKey, status }: { jiraKey: string; status: string }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.lineKey, styles.mono]}>{jiraKey}</Text>
      {status ? <BuildWebToneChip label={status} tone={jiraStatusTone(status)} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    height: 22,
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 8
  },
  text: { fontSize: 11 },
  mono: { fontFamily: typography.monoFamily },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  lineKey: { color: colors.textPrimary, fontSize: typography.bodySize }
})
