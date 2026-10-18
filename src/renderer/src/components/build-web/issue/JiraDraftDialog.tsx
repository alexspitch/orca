import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import type { BuildWebJiraDraft } from '../../../../../shared/build-web-task-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'

const NONE = '__none__'

/**
 * The Jira issue the console would file for the task, after build-web's JiraDraftDialog: shown
 * and edited before anything is sent. The product field and the link back are the console's.
 */
export function JiraDraftDialog({
  target,
  issueId,
  onClose,
  onCreated
}: {
  target: RuntimeClientTarget
  issueId: string
  onClose: () => void
  onCreated: (key: string) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState<BuildWebJiraDraft | null>(null)
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [fixVersion, setFixVersion] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    callBuildWeb(target, 'jiraDraft', { id: issueId })
      .then((next) => {
        if (!alive) {
          return
        }
        setDraft(next)
        setSummary(next.summary)
        setDescription(next.description)
        // The newest unreleased version is the usual answer, and only a default.
        const unreleased = next.versions.filter((v) => !v.released)
        setFixVersion((unreleased.at(-1) ?? next.versions.at(-1))?.id ?? null)
      })
      .catch(
        (failure) => alive && setError(failure instanceof Error ? failure.message : String(failure))
      )
    return () => {
      alive = false
    }
  }, [issueId, target])

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await callBuildWeb(target, 'createJiraIssue', {
        issueId,
        summary: summary.trim(),
        description,
        fixVersionIds: fixVersion ? [fixVersion] : []
      })
      if (result.ok) {
        onCreated(result.value.key)
      } else {
        setError(result.error)
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setBusy(false)
    }
  }

  const needsVersion = Boolean(draft?.fix_versions_required) && !fixVersion
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{translate('buildWeb.jiraDraft.title', 'Create a Jira issue')}</DialogTitle>
          <DialogDescription>
            {draft
              ? translate(
                  'buildWeb.jiraDraft.meta',
                  '{{project}} · {{type}} · Product {{product}}',
                  {
                    project: draft.project,
                    type: draft.type,
                    product: draft.product
                  }
                )
              : translate('buildWeb.jiraDraft.asking', 'Asking Jira which fields it requires…')}
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!draft && !error ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : null}
        {draft ? (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              {translate('buildWeb.jiraDraft.summary', 'Title')}
              <Input value={summary} onChange={(event) => setSummary(event.target.value)} />
            </label>
            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              {translate('buildWeb.jiraDraft.fixVersion', 'Fix version')}
              <Select
                value={fixVersion ?? NONE}
                onValueChange={(v) => setFixVersion(v === NONE ? null : v)}
              >
                <SelectTrigger size="sm" className="w-72" aria-invalid={needsVersion}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    {translate('buildWeb.jiraDraft.noVersion', 'Not chosen')}
                  </SelectItem>
                  {draft.versions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                      {v.released
                        ? ` · ${translate('buildWeb.jiraDraft.released', 'released')}`
                        : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className={needsVersion ? 'text-destructive' : undefined}>
                {draft.fix_versions_required
                  ? translate(
                      'buildWeb.jiraDraft.required',
                      'Jira will not accept the issue without it'
                    )
                  : translate('buildWeb.jiraDraft.optional', 'optional for this issue type')}
              </span>
            </div>
            <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              {translate('buildWeb.jiraDraft.description', 'Description')}
              <Textarea
                variant="code"
                rows={10}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <p className="text-2xs text-muted-foreground">
              {translate(
                'buildWeb.jiraDraft.attachments',
                'The task’s attachments go with it: {{n}}. The last line of the description links back to the console, which ties the two together.',
                { n: String(draft.attachments) }
              )}
            </p>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {translate('buildWeb.jiraDraft.cancel', 'Cancel')}
          </Button>
          <Button
            size="sm"
            disabled={busy || !draft || !summary.trim() || needsVersion}
            onClick={() => void send()}
          >
            {busy ? <Loader2 className="animate-spin" /> : null}
            {translate('buildWeb.jiraDraft.create', 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
