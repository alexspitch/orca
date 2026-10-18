import { useEffect, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebJiraInfo,
  BuildWebJiraTransition
} from '../../../../../../shared/build-web-task-types'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../../build-web-client'
import { BuildWebToneChip } from '../../BuildWebToneChip'
import { jiraStatusTone } from '../../build-web-tones'

const messageOf = (failure: unknown) =>
  failure instanceof Error ? failure.message : String(failure)

/**
 * The guide's Jira issue, after build-web's JiraPanel: its summary and status, whether the guide is
 * already a comment there, and a status move.
 */
export function GuideJiraPanel({
  target,
  jiraKey,
  canWrite
}: {
  target: RuntimeClientTarget
  jiraKey: string
  canWrite: boolean
}): React.JSX.Element {
  const [info, setInfo] = useState<BuildWebJiraInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Loaded on the first open of the menu, dropped after a move: the set depends on the status.
  const [transitions, setTransitions] = useState<BuildWebJiraTransition[] | null>(null)
  const [changing, setChanging] = useState(false)

  useEffect(() => {
    let alive = true
    setBusy(true)
    setError(null)
    setInfo(null)
    setTransitions(null)
    callBuildWeb(target, 'jiraInfo', { jiraKey })
      .then((next) => alive && setInfo(next))
      .catch((failure) => alive && setError(messageOf(failure)))
      .finally(() => alive && setBusy(false))
    return () => {
      alive = false
    }
  }, [jiraKey, target])

  const loadTransitions = async () => {
    if (transitions !== null) {
      return
    }
    try {
      setTransitions(await callBuildWeb(target, 'jiraTransitions', { jiraKey }))
    } catch (failure) {
      setError(messageOf(failure))
      setTransitions([])
    }
  }

  const apply = async (transition: BuildWebJiraTransition) => {
    setChanging(true)
    setError(null)
    try {
      const result = await callBuildWeb(target, 'jiraTransition', {
        jiraKey,
        transition: transition.id
      })
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

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-sm">
      <div className="flex items-center gap-2">
        <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
          {translate('buildWeb.jira.panelTitle', 'Jira · {{key}}', { key: jiraKey })}
        </h3>
        {busy ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {info ? (
        <>
          <p className="font-semibold">{info.summary}</p>
          <div className="flex flex-wrap items-center gap-2">
            <BuildWebToneChip label={info.status} tone={jiraStatusTone(info.status)} />
            {canWrite ? (
              <DropdownMenu onOpenChange={(open) => open && void loadTransitions()}>
                <DropdownMenuTrigger asChild disabled={changing}>
                  <Button variant="ghost" size="xs">
                    {changing
                      ? translate('buildWeb.jira.changing', 'Changing…')
                      : translate('buildWeb.jira.changeStatus', 'Change status')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {transitions === null ? (
                    <DropdownMenuItem disabled>
                      <Loader2 className="animate-spin" />
                      {translate('buildWeb.jira.loading', 'Loading…')}
                    </DropdownMenuItem>
                  ) : transitions.length === 0 ? (
                    <DropdownMenuItem disabled>
                      {translate('buildWeb.jira.noTransitions', 'No transitions available')}
                    </DropdownMenuItem>
                  ) : (
                    transitions.map((t) => (
                      <DropdownMenuItem key={t.id} onSelect={() => void apply(t)}>
                        {t.name}
                        {t.to && t.to !== info.status ? (
                          <span className="text-muted-foreground">→ {t.to}</span>
                        ) : null}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <BuildWebToneChip
              label={
                info.guideComment
                  ? translate('buildWeb.jira.guideExists', 'guide comment exists (will update)')
                  : translate('buildWeb.jira.guideNone', 'no guide comment yet (will create)')
              }
              tone={info.guideComment ? 'green' : 'blue'}
            />
            {info.url ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                onClick={() => void window.api.shell.openUrl(info.url)}
              >
                {translate('buildWeb.jira.open', 'open in Jira')}
                <ExternalLink className="size-3" />
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  )
}
