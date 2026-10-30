import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { Pencil } from 'lucide-react-native'
import type {
  BuildWebIssueDetail,
  BuildWebIssuePatch
} from '../../../../src/shared/build-web-types'
import { stepsOfLines } from '../../../../src/shared/build-web-issue-steps'
import { MobileMarkdown } from '../../components/MobileMarkdown'
import { colors, spacing } from '../../theme/mobile-theme'
import { CardButton, SaveCancelRow, SectionTitle, ui } from './issue-card-ui'

// The task's own text edited in place: the description (Markdown) and the steps to reproduce
// (one per line), as build-web's card edits them.

const stepText = (s: BuildWebIssueDetail['steps'][number]) =>
  s.text ?? [s.action, s.expected].filter(Boolean).join(' → ')

function EditableSection({
  title,
  editLabel,
  current,
  placeholder,
  saving,
  rows,
  onSave,
  children
}: {
  title: string
  editLabel: string
  current: string
  placeholder: string
  saving: boolean
  rows: number
  onSave: (draft: string) => Promise<boolean>
  children: React.ReactNode
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <View style={styles.section}>
      <View style={ui.row}>
        <SectionTitle>{title}</SectionTitle>
        {draft === null ? (
          <CardButton
            variant="ghost"
            icon={Pencil}
            accessibilityLabel={editLabel}
            onPress={() => setDraft(current)}
          />
        ) : null}
      </View>
      {draft === null ? (
        children
      ) : (
        <>
          <TextInput
            autoFocus
            multiline
            value={draft}
            onChangeText={setDraft}
            accessibilityLabel={title}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            style={[ui.input, ui.multiline, { minHeight: rows * 20 }]}
          />
          <SaveCancelRow
            disabled={saving || draft === current}
            onCancel={() => setDraft(null)}
            onSave={() => {
              // Why after the answer: a refused write rolls the card back, and the draft must survive it.
              void onSave(draft).then((saved) => saved && setDraft(null))
            }}
          />
        </>
      )}
    </View>
  )
}

export function IssueDescriptionSection({
  detail,
  saving,
  onSave
}: {
  detail: BuildWebIssueDetail
  saving: boolean
  onSave: (patch: BuildWebIssuePatch) => Promise<boolean>
}) {
  const steps = detail.steps.map(stepText).filter(Boolean)
  return (
    <View style={[ui.panel, styles.gap]}>
      <EditableSection
        title="Description"
        editLabel="Edit the description"
        current={detail.description}
        placeholder="Markdown"
        saving={saving}
        rows={10}
        onSave={(description) => onSave({ description })}
      >
        {detail.description.trim() ? (
          // Why plain links for images: task text comes from build-web's users (tracking pixels).
          <MobileMarkdown content={detail.description} />
        ) : (
          <Text style={ui.muted}>No description.</Text>
        )}
      </EditableSection>
      <EditableSection
        title="Steps"
        editLabel="Edit the steps"
        current={steps.join('\n')}
        placeholder="One step per line"
        saving={saving}
        rows={6}
        onSave={(draft) =>
          onSave({
            steps: stepsOfLines(draft)
          })
        }
      >
        {steps.length ? (
          <View style={styles.steps}>
            {steps.map((step, n) => (
              <View key={`step-${n}`} style={styles.step}>
                <Text style={[ui.body, styles.stepNumber]}>{n + 1}.</Text>
                <Text style={[ui.body, ui.grow]}>{step}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={ui.muted}>No steps.</Text>
        )}
      </EditableSection>
    </View>
  )
}

const styles = StyleSheet.create({
  gap: { gap: spacing.lg },
  section: { gap: spacing.sm },
  steps: { gap: spacing.xs },
  step: { flexDirection: 'row', gap: spacing.sm },
  stepNumber: { minWidth: 20, color: colors.textMuted }
})
