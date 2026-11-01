import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebDeployNotesJob,
  BuildWebIssueDetail
} from '../../../../../../shared/build-web-types'
import { loginOf } from '../../build-web-labels'
import { failedSinceNote, isWritingDeployNotes } from './deploy-notes-job'
import { IssueMarkdown } from './IssuePlanTab'
import type { IssueDeployNotes } from './use-issue-deploy-notes'
import type { IssuePlan } from './use-issue-plan'

const whenOf = (job: BuildWebDeployNotesJob) =>
  new Date(job.finished_at ?? job.created_at).toLocaleString()

/** What the last generation left, when it left no note. */
function JobState({
  job,
  error
}: {
  job: BuildWebDeployNotesJob | null | undefined
  error: string | null
}): React.JSX.Element {
  if (error) {
    return <p className="text-destructive">{error}</p>
  }
  if (job === undefined) {
    return <Loader2 className="size-4 animate-spin" />
  }
  if (!job) {
    return (
      <span>
        {translate(
          'buildWeb.deploy.never',
          'No deploy note yet. build-web writes one when the task goes to “Deploying”.'
        )}
      </span>
    )
  }
  if (isWritingDeployNotes(job)) {
    return (
      <span className="inline-flex items-center gap-2">
        <Loader2 className="size-4 shrink-0 animate-spin" />
        {translate(
          'buildWeb.deploy.writing',
          'The model reads the task’s commits and writes the note — up to twenty minutes. Started {{when}}.',
          { when: new Date(job.created_at).toLocaleString() }
        )}
      </span>
    )
  }
  if (job.status === 'failed') {
    return (
      <span className="text-destructive">
        {translate('buildWeb.deploy.failed', 'Could not write the note ({{when}}): {{error}}', {
          when: whenOf(job),
          error: job.message ?? translate('buildWeb.deploy.noReason', 'no reason recorded')
        })}
      </span>
    )
  }
  if (job.status === 'cancelled') {
    return (
      <span>
        {translate('buildWeb.deploy.cancelled', 'Writing the note was cancelled {{when}}.', {
          when: whenOf(job)
        })}
      </span>
    )
  }
  // Why: a success without a reason wrote a note, and the note was taken out of the tab since.
  return (
    <span>
      {job.message
        ? translate('buildWeb.deploy.nothing', 'Checked {{when}}: {{reason}}.', {
            when: whenOf(job),
            reason: job.message
          })
        : translate(
            'buildWeb.deploy.removed',
            'A note was written {{when}} and taken out of the tab since.',
            { when: whenOf(job) }
          )}
    </span>
  )
}

/**
 * The note for the deployment engineers (IS-341): environment variables, service interactions,
 * external APIs and the other changes the task brings to a deployment, each with its commit.
 * build-web writes it when the task goes out; a task that changes nothing for them gets none.
 */
export function IssueDeployTab({
  detail,
  note,
  notes
}: {
  detail: BuildWebIssueDetail
  /** The files marked as the note, read as the plan is. */
  note: IssuePlan
  notes: IssueDeployNotes
}): React.JSX.Element {
  const { plans: files, shown, text, error } = note
  const { job } = notes
  const writing = isWritingDeployNotes(job)
  const again = (
    <Button
      variant="outline"
      size="sm"
      disabled={writing || notes.starting || job === undefined}
      onClick={notes.start}
    >
      {job
        ? translate('buildWeb.deploy.writeAgain', 'Write again')
        : translate('buildWeb.deploy.write', 'Write')}
    </Button>
  )
  if (!shown) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-3 rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        <JobState job={job} error={notes.error} />
        {again}
      </div>
    )
  }
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {files.length > 1 ? (
          <Select value={shown.id} onValueChange={note.choose}>
            <SelectTrigger size="sm" aria-label={translate('buildWeb.deploy.file', 'Note file')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {files.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="font-mono">{shown.name}</span>
        )}
        <span className="flex-1">
          · {loginOf(shown.created_by)} · {new Date(shown.created_at).toLocaleString()}
        </span>
        {again}
      </div>
      {writing ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {translate(
            'buildWeb.deploy.rewriting',
            'A new note is being written — this one will be replaced or removed.'
          )}
        </p>
      ) : null}
      {failedSinceNote(job, shown.created_at) ? (
        <p className="rounded-md border border-status-warning-border bg-status-warning-background px-3 py-2 text-xs text-status-warning">
          {job.status === 'failed'
            ? translate(
                'buildWeb.deploy.laterFailed',
                'Could not write a new note ({{when}}): {{error}}. The earlier one is below.',
                {
                  when: whenOf(job),
                  error: job.message ?? translate('buildWeb.deploy.noReason', 'no reason recorded')
                }
              )
            : translate(
                'buildWeb.deploy.laterCancelled',
                'Writing a new note was cancelled {{when}}. The earlier one is below.',
                { when: whenOf(job) }
              )}
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {text === null && !error ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : null}
      {text !== null ? <IssueMarkdown detail={detail} text={text} /> : null}
    </div>
  )
}
