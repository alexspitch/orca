import { useCallback, useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebIssueDetail,
  BuildWebIssuePatch,
  BuildWebIssueRow,
  BuildWebTester
} from '../../../../shared/build-web-types'
import type { BuildWebTestingStatus } from '../../../../shared/build-web-run-types'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { callBuildWeb } from './build-web-client'
import { personLabel } from './build-web-labels'
import { InlineSelect, PropertyRow } from './BuildWebPropertyControls'
import { testerChoices, testerKindOf, type TesterKind } from './issue/issue-tester'

const DEFAULT = '__default__'

/** The tester picker's people; `load` reads them again, for a person added since. */
export function useBuildWebTesters(target: RuntimeClientTarget): {
  people: BuildWebTester[]
  load: () => void
} {
  const [people, setPeople] = useState<BuildWebTester[]>([])
  const load = useCallback(() => {
    void callBuildWeb(target, 'listTesters').then(setPeople, () => undefined)
  }, [target])
  useEffect(load, [load])
  return { people, load }
}

/**
 * IS-347: who accepts the task after the train, as build-web's card shows it. Self-testing is the
 * assignee and is not chosen; «Done» right after the train needs nobody. Empty while one is needed
 * is drawn as an error: the console found nobody to put there.
 */
export function IssueTesterRow({
  target,
  detail,
  afterTrain,
  disabled,
  onSave
}: {
  target: RuntimeClientTarget
  detail: BuildWebIssueDetail
  afterTrain: BuildWebTestingStatus
  disabled: boolean
  onSave: (patch: BuildWebIssuePatch) => Promise<void> | void
}): React.JSX.Element {
  const { people, load } = useBuildWebTesters(target)
  const tester = detail.tester ?? ''
  const kind = testerKindOf(detail, afterTrain)
  const label = translate('buildWeb.props.tester', 'Tester')
  if (!kind || kind === 'self') {
    return (
      <PropertyRow label={label}>
        {!kind ? (
          <span className="text-xs text-muted-foreground">
            {translate('buildWeb.props.testerNotNeeded', 'Not needed')}
          </span>
        ) : tester ? (
          <span className="truncate">
            {translate('buildWeb.props.testerSelf', '{{who}} — self-testing', {
              who: personLabel(tester, people)
            })}
          </span>
        ) : (
          <span className="text-destructive">
            {translate('buildWeb.props.testerNoAssignee', 'No assignee')}
          </span>
        )}
      </PropertyRow>
    )
  }
  return (
    <PropertyRow label={label}>
      <InlineSelect
        label={label}
        value={tester || DEFAULT}
        disabled={disabled}
        invalid={!tester}
        onChange={(v) => void onSave({ tester: v === DEFAULT ? '' : v })}
        onOpen={load}
        options={[
          {
            value: DEFAULT,
            label: tester
              ? translate('buildWeb.props.testerDefault', 'Default')
              : translate('buildWeb.props.testerMissing', 'Not assigned')
          },
          ...testerChoices(kind, detail, people, (who) => personLabel(who, people))
        ]}
      />
    </PropertyRow>
  )
}

/**
 * A new task's «Tester»: the console's default, or a person for the check it is headed for. An
 * external check needs one: a task made here has no Jira author, and finish refuses it without.
 */
export function NewIssueTesterRow({
  target,
  kind,
  issue,
  value,
  disabled,
  onChange
}: {
  target: RuntimeClientTarget
  kind: Exclude<TesterKind, 'self'>
  issue: Pick<BuildWebIssueRow, 'product' | 'assignee'>
  value: string
  disabled: boolean
  onChange: (tester: string) => void
}): React.JSX.Element {
  const { people, load } = useBuildWebTesters(target)
  const label = translate('buildWeb.props.tester', 'Tester')
  const missing = kind === 'external' && !value
  return (
    <PropertyRow label={label}>
      <InlineSelect
        label={label}
        value={value || DEFAULT}
        disabled={disabled}
        invalid={missing}
        onChange={(v) => onChange(v === DEFAULT ? '' : v)}
        onOpen={load}
        options={[
          {
            value: DEFAULT,
            label: missing
              ? translate('buildWeb.props.testerMissing', 'Not assigned')
              : translate('buildWeb.props.testerDefault', 'Default')
          },
          ...testerChoices(kind, { ...issue, tester: value }, people, (who) =>
            personLabel(who, people)
          )
        ]}
      />
    </PropertyRow>
  )
}
