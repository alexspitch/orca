import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { BuildWebJiraDraft } from '../../../../../../src/shared/build-web-task-types'
import { BottomDrawer } from '../../../../components/BottomDrawer'
import { LoadingSpinner } from '../../../../components/LoadingSpinner'
import { colors, radii, spacing } from '../../../../theme/mobile-theme'
import { useBuildWebScreen } from '../../../build-web-screen-context'
import { GuideButton } from './GuideButton'
import { guideStyles } from './guide-tab-styles'
import { messageOf } from './guide-failure'

/** One fix version to pick, or none: a sheet holds them inline rather than in a second sheet. */
function VersionChip({
  label,
  active,
  onPress
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={active}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[guideStyles.meta, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  )
}

function DraftForm({
  issueId,
  onClose,
  onCreated
}: {
  issueId: string
  onClose: () => void
  onCreated: (key: string) => void
}) {
  const { call } = useBuildWebScreen()
  const [draft, setDraft] = useState<BuildWebJiraDraft | null>(null)
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [fixVersion, setFixVersion] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    call('jiraDraft', { id: issueId })
      .then((next) => {
        if (!alive) {
          return
        }
        setDraft(next)
        setSummary(next.summary)
        setDescription(next.description)
        // The newest unreleased version is the usual answer, and only a default.
        const unreleased = next.versions.filter((v) => !v.released)
        setFixVersion((unreleased.at(-1) ?? next.versions.at(-1))?.id ?? null)
      })
      .catch((failure) => alive && setError(messageOf(failure)))
    return () => {
      alive = false
    }
  }, [call, issueId])

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await call('createJiraIssue', {
        issueId,
        summary: summary.trim(),
        description,
        fixVersionIds: fixVersion ? [fixVersion] : []
      })
      if (result.ok) {
        onCreated(result.value.key)
      } else {
        setError(result.error)
      }
    } catch (failure) {
      setError(messageOf(failure))
    } finally {
      setBusy(false)
    }
  }

  const needsVersion = Boolean(draft?.fix_versions_required) && !fixVersion
  return (
    <View style={{ gap: spacing.md, paddingHorizontal: spacing.xs }}>
      <View style={{ gap: 2 }}>
        <Text style={guideStyles.title}>Create a Jira issue</Text>
        <Text style={guideStyles.meta}>
          {draft
            ? `${draft.project} · ${draft.type} · Product ${draft.product}`
            : 'Asking Jira which fields it requires…'}
        </Text>
      </View>
      {error ? <Text style={guideStyles.danger}>{error}</Text> : null}
      {!draft && !error ? <LoadingSpinner size={16} color={colors.textMuted} /> : null}
      {draft ? (
        <>
          <View style={guideStyles.field}>
            <Text style={guideStyles.meta}>Title</Text>
            <TextInput value={summary} onChangeText={setSummary} style={guideStyles.input} />
          </View>
          <View style={guideStyles.field}>
            <Text style={guideStyles.meta}>Fix version</Text>
            <View style={guideStyles.wrapRow} accessibilityRole="radiogroup">
              <VersionChip
                label="Not chosen"
                active={fixVersion === null}
                onPress={() => setFixVersion(null)}
              />
              {draft.versions.map((v) => (
                <VersionChip
                  key={v.id}
                  label={v.released ? `${v.name} · released` : v.name}
                  active={fixVersion === v.id}
                  onPress={() => setFixVersion(v.id)}
                />
              ))}
            </View>
            <Text style={needsVersion ? guideStyles.danger : guideStyles.small}>
              {draft.fix_versions_required
                ? 'Jira will not accept the issue without it'
                : 'optional for this issue type'}
            </Text>
          </View>
          <View style={guideStyles.field}>
            <Text style={guideStyles.meta}>Description</Text>
            <TextInput
              multiline
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
              style={[guideStyles.input, guideStyles.code, { minHeight: 200 }]}
            />
          </View>
          <Text style={guideStyles.small}>
            {`The task’s attachments go with it: ${draft.attachments}. The last line of the description links back to the console, which ties the two together.`}
          </Text>
        </>
      ) : null}
      <View style={[guideStyles.row, { justifyContent: 'flex-end' }]}>
        <GuideButton variant="ghost" label="Cancel" onPress={onClose} />
        <GuideButton
          variant="primary"
          label="Create"
          busy={busy}
          disabled={busy || !draft || !summary.trim() || needsVersion}
          onPress={() => void send()}
        />
      </View>
    </View>
  )
}

/**
 * The Jira issue the console would file for the task, after build-web's JiraDraftDialog: shown
 * and edited before anything is sent. The product field and the link back are the console's.
 */
export function JiraDraftSheet({
  issueId,
  visible,
  onClose,
  onCreated
}: {
  issueId: string
  visible: boolean
  onClose: () => void
  onCreated: (key: string) => void
}) {
  return (
    <BottomDrawer visible={visible} onClose={onClose}>
      <DraftForm issueId={issueId} onClose={onClose} onCreated={onCreated} />
    </BottomDrawer>
  )
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radii.row,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2
  },
  chipActive: { backgroundColor: colors.surfaceBright, borderColor: colors.surfaceBright },
  chipTextActive: { color: colors.bgBase, fontWeight: '600' }
})
