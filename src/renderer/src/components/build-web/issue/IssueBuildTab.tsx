import { useState } from 'react'
import { CloudUpload, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueDetail } from '../../../../../shared/build-web-types'
import type { BuildWebRun } from '../../../../../shared/build-web-run-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { BuildWebListState } from '../BuildWebListState'
import { imageTally } from './issue-card-facts'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { runStatusTone } from '../build-web-tones'

export function IssueBuildTab({
  target,
  detail,
  run,
  error,
  canWrite,
  onPushed
}: {
  target: RuntimeClientTarget
  detail: BuildWebIssueDetail
  run: BuildWebRun | null | undefined
  error: string | null
  canWrite: boolean
  onPushed: () => void
}): React.JSX.Element {
  const [pushing, setPushing] = useState(false)
  if (error) {
    return <BuildWebListState kind="error" error={error} onRetry={onPushed} />
  }
  if (run === undefined) {
    return (
      <BuildWebListState
        kind="loading"
        loadingLabel={translate('buildWeb.state.loadingCard', 'Loading…')}
      />
    )
  }
  const openInBuildWeb = () => void window.api.shell.openUrl(detail.url)
  if (run === null) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">
          {translate('buildWeb.build.none', 'The task has no build yet.')}
        </p>
        <Button variant="outline" size="sm" onClick={openInBuildWeb}>
          {translate('buildWeb.build.inBuildWeb', 'Build in build-web')}
          <ExternalLink />
        </Button>
      </div>
    )
  }
  const tally = imageTally(run)
  const built = run.builds.filter((b) => b.status === 'SUCCESS')
  const offersBuildTag = built.some((b) => !b.pushed)
  const offersMainTag = built.some((b) => !b.main_tag_pushed)
  const push = async (moveMainTag: boolean): Promise<void> => {
    setPushing(true)
    try {
      const result = await callBuildWeb(target, 'pushRun', { runId: run.id, moveMainTag })
      if (result.ok) {
        toast.success(
          translate('buildWeb.images.pushStarted', 'Push started — build-web publishes the tags.')
        )
        onPushed()
      } else {
        toast.error(result.error)
      }
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setPushing(false)
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-center gap-6 rounded-lg border border-border bg-card p-4 text-sm">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {translate('buildWeb.build.status', 'Status')}
          </span>
          <BuildWebToneChip label={run.status} tone={runStatusTone(run.status)} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {translate('buildWeb.build.branch', 'Branch')}
          </span>
          <BuildWebToneChip label={run.branch} tone={null} mono />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {translate('buildWeb.build.images', 'Images')}
          </span>
          <span>
            {tally.ok} / {tally.total}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {translate('buildWeb.build.testing', 'Testing')}
          </span>
          <span>{run.testing_status || '—'}</span>
        </div>
        <div className="flex-1" />
        {canWrite && (offersBuildTag || offersMainTag) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={pushing}>
                <CloudUpload />
                {translate('buildWeb.images.push', 'Push to registry')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {offersBuildTag ? (
                <DropdownMenuItem onSelect={() => void push(false)}>
                  {translate('buildWeb.images.pushBuildTag', 'Build tag only')}
                </DropdownMenuItem>
              ) : null}
              {offersMainTag ? (
                <DropdownMenuItem onSelect={() => void push(true)}>
                  {translate('buildWeb.images.pushBoth', 'Build tag and main tag')}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Button variant="outline" size="sm" onClick={openInBuildWeb}>
          {translate('buildWeb.build.inBuildWeb', 'Build in build-web')}
          <ExternalLink />
        </Button>
      </section>
      <div className="scrollbar-sleek overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
              <th className="px-3 py-2">{translate('buildWeb.images.image', 'Image')}</th>
              <th className="w-16 py-2">{translate('buildWeb.images.dist', 'dist')}</th>
              <th className="w-40 py-2">{translate('buildWeb.build.branch', 'Branch')}</th>
              <th className="w-28 py-2">{translate('buildWeb.build.status', 'Status')}</th>
              <th className="w-24 py-2">{translate('buildWeb.build.tests', 'Tests')}</th>
              <th className="w-20 py-2">{translate('buildWeb.images.log', 'Log')}</th>
              <th className="w-28 py-2 pr-3">
                {translate('buildWeb.images.registry', 'Registry')}
              </th>
            </tr>
          </thead>
          <tbody>
            {run.builds.map((b) => (
              <tr key={`${b.image}|${b.dist}|${b.branch}`} className="border-b border-border">
                <td className="truncate px-3 py-2 font-mono text-xs">{b.image}</td>
                <td className="py-2 text-xs">{b.dist}</td>
                <td className="py-2 pr-2">
                  <BuildWebToneChip label={b.branch} tone={null} mono />
                </td>
                <td className="py-2">
                  <BuildWebToneChip label={b.status} tone={runStatusTone(b.status)} />
                </td>
                <td className="py-2">
                  <BuildWebToneChip
                    label={
                      b.tests_skipped
                        ? translate('buildWeb.build.skipped', 'skipped')
                        : translate('buildWeb.build.ran', 'ran')
                    }
                    tone={b.tests_skipped ? 'amber' : 'neutral'}
                  />
                </td>
                <td className="py-2">
                  {b.url && /^https?:\/\//.test(b.url) ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (b.url) {
                          void window.api.shell.openUrl(b.url)
                        }
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      #{b.number ?? '—'}
                    </button>
                  ) : null}
                </td>
                <td className="py-2 pr-3">
                  {b.status === 'SUCCESS' ? (
                    <BuildWebToneChip
                      label={
                        b.pushed
                          ? translate('buildWeb.images.pushed', 'pushed')
                          : translate('buildWeb.images.notPushed', 'not pushed')
                      }
                      tone={b.pushed ? 'green' : 'amber'}
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
