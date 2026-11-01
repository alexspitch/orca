import { useCallback, useEffect, useState } from 'react'
import { Text } from 'react-native'
import type {
  BuildWebIssueDetail,
  BuildWebIssuePatch,
  BuildWebIssueRow,
  BuildWebTester
} from '../../../../src/shared/build-web-types'
import type { BuildWebTestingStatus } from '../../../../src/shared/build-web-run-types'
import { BUILD_WEB_ISSUE_TESTER_RUNTIME_CAPABILITY } from '../../../../src/shared/build-web-capability'
import {
  testerChoices,
  testerKindOf,
  type TesterKind
} from '../../../../src/renderer/src/components/build-web/issue/issue-tester'
import { personLabel } from '../build-web-labels'
import { useBuildWebScreen } from '../build-web-screen-context'
import { ErrorText, MutedText, ui } from './issue-card-ui'
import { PropertyRow, PropertySelect } from './IssuePropertySelect'

const DEFAULT = '__default__'

/** The tester picker's people, from a host that knows them; `load` reads them again. */
function useBuildWebTesters(): { people: BuildWebTester[]; load: () => void } {
  const { call, hostCapabilities } = useBuildWebScreen()
  const capable = hostCapabilities.includes(BUILD_WEB_ISSUE_TESTER_RUNTIME_CAPABILITY)
  const [people, setPeople] = useState<BuildWebTester[]>([])
  const load = useCallback(() => {
    if (capable) {
      void call('listTesters').then(setPeople, () => undefined)
    }
  }, [call, capable])
  useEffect(load, [load])
  return { people, load }
}

/**
 * The desktop's IssueTesterRow (IS-347): who accepts the task after the train. Self-testing is the
 * assignee and is not chosen; «Done» right after the train needs nobody; a missing one is in red.
 */
export function IssueTesterRow({
  detail,
  afterTrain,
  disabled,
  onSave
}: {
  detail: BuildWebIssueDetail
  afterTrain: BuildWebTestingStatus
  disabled: boolean
  onSave: (patch: BuildWebIssuePatch) => Promise<unknown> | void
}) {
  const { people, load } = useBuildWebTesters()
  const tester = detail.tester ?? ''
  const kind = testerKindOf(detail, afterTrain)
  if (!kind || kind === 'self') {
    return (
      <PropertyRow label="Tester">
        {!kind ? (
          <MutedText>Not needed</MutedText>
        ) : tester ? (
          <Text style={ui.body} numberOfLines={1}>
            {`${personLabel(tester, people)} — self-testing`}
          </Text>
        ) : (
          <ErrorText>No assignee</ErrorText>
        )}
      </PropertyRow>
    )
  }
  return (
    <PropertyRow label="Tester">
      <PropertySelect
        label="Tester"
        value={tester || DEFAULT}
        shown={tester ? undefined : <ErrorText>Not assigned</ErrorText>}
        disabled={disabled}
        onOpen={load}
        options={[
          { value: DEFAULT, label: tester ? 'Default' : 'Not assigned' },
          ...testerChoices(kind, detail, people, (who) => personLabel(who, people))
        ]}
        onChange={(v) => void onSave({ tester: v === DEFAULT ? '' : v })}
      />
    </PropertyRow>
  )
}

/**
 * The desktop's NewIssueTesterRow: a new task's tester, the console's default or a person. An
 * external check needs one: a task made here has no Jira author, and finish refuses it without.
 */
export function NewIssueTesterRow({
  kind,
  issue,
  value,
  disabled,
  onChange
}: {
  kind: Exclude<TesterKind, 'self'>
  issue: Pick<BuildWebIssueRow, 'product' | 'assignee'>
  value: string
  disabled: boolean
  onChange: (tester: string) => void
}) {
  const { people, load } = useBuildWebTesters()
  const missing = kind === 'external' && !value
  return (
    <PropertyRow label="Tester">
      <PropertySelect
        label="Tester"
        value={value || DEFAULT}
        shown={missing ? <ErrorText>Not assigned</ErrorText> : undefined}
        disabled={disabled}
        onOpen={load}
        options={[
          { value: DEFAULT, label: missing ? 'Not assigned' : 'Default' },
          ...testerChoices(kind, { ...issue, tester: value }, people, (who) =>
            personLabel(who, people)
          )
        ]}
        onChange={(v) => onChange(v === DEFAULT ? '' : v)}
      />
    </PropertyRow>
  )
}
