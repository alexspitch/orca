import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { Sparkles } from 'lucide-react-native'
import { MobileSegmentedControl } from '../../../../components/MobileSegmentedControl'
import { colors, spacing } from '../../../../theme/mobile-theme'
import { GuideButton } from './GuideButton'
import { GuidePreview } from './GuidePreview'
import { guideStyles } from './guide-tab-styles'

type GuideView = 'preview' | 'markdown'
const VIEWS = [
  { value: 'preview', label: 'Preview' },
  { value: 'markdown', label: 'Markdown' }
] as const

/**
 * The guide's own card: generate or regenerate it, keep the built images current, save hand
 * edits, and revise it by a comment. The Markdown and the comment as it will read share one
 * place on a phone, switched by a segment.
 */
export function GuideEditor({
  guide,
  preview,
  sources,
  note,
  hasTicket,
  hasBuild,
  canWrite,
  streaming,
  refreshing,
  saved,
  onEdit,
  onGenerate,
  onRefreshImages,
  onSave,
  onRevise
}: {
  guide: string
  /** The guide with its screenshots resolved, for the preview. */
  preview: string
  sources: ReadonlyMap<string, string>
  note: string
  hasTicket: boolean
  hasBuild: boolean
  canWrite: boolean
  streaming: boolean
  refreshing: boolean
  saved: boolean
  onEdit: (text: string) => void
  onGenerate: () => void
  onRefreshImages: () => void
  onSave: () => void
  onRevise: (feedback: string) => void
}) {
  const [feedback, setFeedback] = useState('')
  const [view, setView] = useState<GuideView>('preview')
  const revise = () => {
    if (feedback.trim() && guide) {
      onRevise(feedback.trim())
      setFeedback('')
    }
  }
  const generateLabel = streaming ? 'Generating…' : guide ? 'Regenerate' : 'Generate'
  return (
    <View style={guideStyles.card}>
      <View style={{ gap: 2 }}>
        <Text style={guideStyles.title}>Feature guide</Text>
        <Text style={guideStyles.meta}>
          {note}
          {hasBuild ? '' : ' No image is built yet — the «Built images» section will be empty.'}
        </Text>
      </View>
      {canWrite ? (
        <View style={guideStyles.wrapRow}>
          <GuideButton
            variant="primary"
            icon={Sparkles}
            label={generateLabel}
            busy={streaming}
            disabled={streaming || !hasTicket}
            onPress={onGenerate}
          />
          <GuideButton
            label={refreshing ? 'Refreshing…' : 'Refresh images'}
            disabled={streaming || refreshing || !guide}
            onPress={onRefreshImages}
          />
          <GuideButton
            label={saved ? 'Saved' : 'Save edits'}
            disabled={streaming || !guide}
            onPress={onSave}
          />
        </View>
      ) : null}
      {!hasTicket ? (
        <Text style={guideStyles.meta}>
          This build has no ticket — no guide can be built from a diff.
        </Text>
      ) : null}
      {!guide && !streaming ? (
        <View style={guideStyles.empty}>
          <Text style={guideStyles.title}>No guide yet</Text>
          <Text style={[guideStyles.meta, guideStyles.centered]}>
            The model reads the task’s changes and writes the guide: what changed, how to check it,
            which images are built and where it lives in the code. The text can be edited by hand
            and revised by a comment.
          </Text>
          {canWrite ? (
            <GuideButton
              variant="primary"
              label="Generate"
              disabled={!hasTicket}
              onPress={onGenerate}
            />
          ) : null}
        </View>
      ) : (
        <>
          <MobileSegmentedControl segments={VIEWS} selected={view} onSelect={setView} fill />
          {view === 'markdown' ? (
            <View style={guideStyles.field}>
              <Text style={guideStyles.meta}>Markdown · edited by hand</Text>
              <TextInput
                multiline
                value={guide}
                editable={canWrite && !streaming}
                onChangeText={onEdit}
                autoCapitalize="none"
                autoCorrect={false}
                textAlignVertical="top"
                placeholderTextColor={colors.textMuted}
                style={[guideStyles.input, guideStyles.code, { minHeight: 360 }]}
              />
            </View>
          ) : (
            <View style={guideStyles.field}>
              <Text style={guideStyles.meta}>Preview · as the comment will read</Text>
              <View style={[guideStyles.input, { paddingVertical: spacing.md }]}>
                <GuidePreview markdown={preview} sources={sources} growing={streaming} />
              </View>
            </View>
          )}
          {canWrite ? (
            <View style={guideStyles.field}>
              <Text style={guideStyles.meta}>Revise by a comment</Text>
              <TextInput
                value={feedback}
                onChangeText={setFeedback}
                placeholder="e.g. shorter; add an example for sampling"
                placeholderTextColor={colors.textMuted}
                returnKeyType="send"
                onSubmitEditing={revise}
                style={guideStyles.input}
              />
              <View style={{ alignSelf: 'flex-end' }}>
                <GuideButton
                  label="Revise"
                  disabled={streaming || !feedback.trim() || !guide}
                  onPress={revise}
                />
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  )
}
