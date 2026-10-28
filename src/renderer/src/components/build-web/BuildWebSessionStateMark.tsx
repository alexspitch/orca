import { Hourglass, SquareTerminal, Timer } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import { BUILD_WEB_SESSION_STATE_LABELS } from '../../../../shared/build-web-session-labels'
import { taskSessionState } from '../../../../shared/build-web-session-rows'

const MARKS = {
  active: { Icon: SquareTerminal, hue: 'text-chip-tone-blue' },
  waiting: { Icon: Timer, hue: 'text-chip-tone-sky' },
  closing: { Icon: Hourglass, hue: 'text-muted-foreground' }
} as const

/** A task row's session, by its state: in progress, awaiting release, closing soon. */
export function BuildWebSessionStateMark({
  issue
}: {
  issue: Pick<BuildWebIssueRow, 'agent_session' | 'agent_session_state'>
}): React.JSX.Element | null {
  const state = taskSessionState(issue)
  if (!state) {
    return null
  }
  const { Icon, hue } = MARKS[state]
  const label = BUILD_WEB_SESSION_STATE_LABELS[state].full
  const words = translate(label.key, label.text)
  const session = issue.agent_session
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={hue}>
          <Icon className="size-3.5" aria-label={words} />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {session ? `${words} · ${session.agent} · ${session.worktree_name}` : words}
      </TooltipContent>
    </Tooltip>
  )
}
