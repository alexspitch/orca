import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ExternalLink } from 'lucide-react-native'
import type {
  BuildWebJiraInfo,
  BuildWebJiraTransition
} from '../../../../../../src/shared/build-web-task-types'
import { jiraStatusTone } from '../../../../../../src/renderer/src/components/build-web/build-web-tones'
import { ActionSheetModal, type ActionSheetAction } from '../../../../components/ActionSheetModal'
import { LoadingSpinner } from '../../../../components/LoadingSpinner'
import { openExternalLink } from '../../../../platform/external-link'
import { colors } from '../../../../theme/mobile-theme'
import { BuildWebToneChip } from '../../../BuildWebToneChip'
import { useBuildWebScreen } from '../../../build-web-screen-context'
import { GuideButton } from './GuideButton'
import { guideStyles } from './guide-tab-styles'
import { messageOf } from './guide-failure'

/**
 * The guide's Jira issue, after build-web's JiraPanel: its summary and status, whether the guide is
 * already a comment there, and a status move.
 */
export function GuideJiraPanel({ jiraKey, canWrite }: { jiraKey: string; canWrite: boolean }) {
  const { call } = useBuildWebScreen()
  const [info, setInfo] = useState<BuildWebJiraInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Loaded on the first open of the menu, dropped after a move: the set depends on the status.
  const [transitions, setTransitions] = useState<BuildWebJiraTransition[] | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [changing, setChanging] = useState(false)

  useEffect(() => {
    let alive = true
    setBusy(true)
    setError(null)
    setInfo(null)
    setTransitions(null)
    call('jiraInfo', { jiraKey })
      .then((next) => alive && setInfo(next))
      .catch((failure) => alive && setError(messageOf(failure)))
      .finally(() => alive && setBusy(false))
    return () => {
      alive = false
    }
  }, [call, jiraKey])

  const openMenu = async () => {
    setMenuOpen(true)
    if (transitions !== null) {
      return
    }
    try {
      setTransitions(await call('jiraTransitions', { jiraKey }))
    } catch (failure) {
      setError(messageOf(failure))
      setTransitions([])
    }
  }

  const apply = async (transition: BuildWebJiraTransition) => {
    setChanging(true)
    setError(null)
    try {
      const result = await call('jiraTransition', { jiraKey, transition: transition.id })
      if (result.ok) {
        setInfo((current) => (current ? { ...current, status: result.value } : current))
        setTransitions(null)
      } else {
        setError(result.error)
      }
    } catch (failure) {
      setError(messageOf(failure))
    } finally {
      setChanging(false)
    }
  }

  const actions: ActionSheetAction[] =
    transitions === null
      ? [{ label: 'Loading…', disabled: true, loading: true, onPress: () => {} }]
      : transitions.length === 0
        ? [{ label: 'No transitions available', disabled: true, onPress: () => {} }]
        : transitions.map((t) => ({
            label: t.name,
            hint: t.to && t.to !== info?.status ? `→ ${t.to}` : undefined,
            onPress: () => void apply(t)
          }))

  return (
    <View style={guideStyles.card}>
      <View style={guideStyles.headingRow}>
        <Text style={guideStyles.heading}>Jira · {jiraKey}</Text>
        {busy ? <LoadingSpinner size={14} color={colors.textMuted} /> : null}
      </View>
      {error ? <Text style={guideStyles.danger}>{error}</Text> : null}
      {info ? (
        <>
          <Text style={guideStyles.title}>{info.summary}</Text>
          <View style={guideStyles.wrapRow}>
            <BuildWebToneChip label={info.status} tone={jiraStatusTone(info.status)} />
            {canWrite ? (
              <GuideButton
                compact
                variant="ghost"
                label={changing ? 'Changing…' : 'Change status'}
                disabled={changing}
                onPress={() => void openMenu()}
              />
            ) : null}
          </View>
          <BuildWebToneChip
            label={
              info.guideComment
                ? 'guide comment exists (will update)'
                : 'no guide comment yet (will create)'
            }
            tone={info.guideComment ? 'green' : 'blue'}
          />
          {info.url ? (
            <Pressable
              accessibilityRole="link"
              style={guideStyles.row}
              onPress={() => openExternalLink(info.url)}
            >
              <Text style={guideStyles.link}>open in Jira</Text>
              <ExternalLink size={12} color={colors.accentBlue} />
            </Pressable>
          ) : null}
        </>
      ) : null}
      <ActionSheetModal
        visible={menuOpen}
        title={`Move ${jiraKey}`}
        actions={actions}
        onClose={() => setMenuOpen(false)}
      />
    </View>
  )
}
