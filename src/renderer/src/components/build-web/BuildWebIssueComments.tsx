import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { translate } from '@/i18n/i18n'
import type { BuildWebComment, BuildWebIssueDetail } from '../../../../shared/build-web-types'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { callBuildWeb } from './build-web-client'
import { useBuildWebStore } from './build-web-store'
import { loginOf } from './build-web-labels'

const messageOf = (failure: unknown) =>
  failure instanceof Error ? failure.message : String(failure)

function jiraNote(jira: { ok: true; status: string } | { ok: false; error: string } | null): void {
  if (jira && !jira.ok) {
    toast.error(
      translate('buildWeb.comment.notInJira', 'Saved, but Jira was not updated: {{error}}', {
        error: jira.error
      })
    )
  }
}

/** One comment; its author may correct it or take it back, as build-web allows. */
function CommentItem({
  target,
  issueId,
  comment: c,
  mine,
  onChanged
}: {
  target: RuntimeClientTarget
  issueId: string
  comment: BuildWebComment
  mine: boolean
  onChanged: () => void
}): React.JSX.Element {
  const confirm = useConfirmationDialog()
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const body = (draft ?? '').trim()
    if (!body || body === c.body) {
      setDraft(null)
      return
    }
    setBusy(true)
    try {
      const result = await callBuildWeb(target, 'editComment', {
        id: issueId,
        commentId: c.id,
        body
      })
      if (result.ok) {
        setDraft(null)
        jiraNote(result.value.jira)
        onChanged()
      } else {
        toast.error(result.error)
      }
    } catch (failure) {
      toast.error(messageOf(failure))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    const accepted = await confirm({
      title: translate('buildWeb.comment.deleteTitle', 'Delete this comment?'),
      description: c.jira_sync
        ? translate('buildWeb.comment.deleteJira', 'It is deleted from the Jira issue too.')
        : undefined,
      confirmLabel: translate('buildWeb.comment.delete', 'Delete'),
      confirmVariant: 'destructive'
    })
    if (!accepted) {
      return
    }
    setBusy(true)
    try {
      const result = await callBuildWeb(target, 'deleteComment', { id: issueId, commentId: c.id })
      if (result.ok) {
        jiraNote(result.value.jira)
        onChanged()
      } else {
        toast.error(result.error)
      }
    } catch (failure) {
      toast.error(messageOf(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="group flex flex-col gap-1">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>
          {loginOf(c.author)} · {new Date(c.created_at).toLocaleString()}
          {c.edited_at ? ` · ${translate('buildWeb.comment.edited', 'edited')}` : ''}
          {c.jira_sync ? ` · ${translate('buildWeb.comment.inJira', 'Jira')}` : ''}
        </span>
        {mine && draft === null ? (
          <span className="ml-auto flex opacity-60 group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={busy}
              aria-label={translate('buildWeb.comment.edit', 'Edit the comment')}
              title={translate('buildWeb.comment.edit', 'Edit the comment')}
              onClick={() => setDraft(c.body)}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={busy}
              aria-label={translate('buildWeb.comment.delete', 'Delete')}
              title={translate('buildWeb.comment.delete', 'Delete')}
              onClick={() => void remove()}
            >
              <Trash2 />
            </Button>
          </span>
        ) : null}
      </div>
      {draft === null ? (
        <CommentMarkdown content={c.body} variant="compact" className="text-sm" />
      ) : (
        <div className="flex flex-col gap-2">
          <Textarea
            autoFocus
            rows={3}
            maxLength={4000}
            value={draft}
            aria-label={translate('buildWeb.comment.edit', 'Edit the comment')}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                void save()
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              {translate('buildWeb.edit.cancel', 'Cancel')}
            </Button>
            <Button size="sm" disabled={busy || !draft.trim()} onClick={() => void save()}>
              {translate('buildWeb.edit.save', 'Save')}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

/** The task's comments; the ones the token owner wrote can be corrected or deleted. */
export function BuildWebIssueComments({
  target,
  detail,
  onChanged
}: {
  target: RuntimeClientTarget
  detail: BuildWebIssueDetail
  onChanged: () => void
}): React.JSX.Element {
  const me = useBuildWebStore((s) => s.status?.login ?? null)?.toLowerCase() ?? null
  if (detail.comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {translate('buildWeb.detail.noComments', 'No comments.')}
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-3">
      {detail.comments.map((c) => (
        <CommentItem
          key={c.id}
          target={target}
          issueId={detail.id}
          comment={c}
          mine={me !== null && c.author.toLowerCase() === me}
          onChanged={onChanged}
        />
      ))}
    </ul>
  )
}
