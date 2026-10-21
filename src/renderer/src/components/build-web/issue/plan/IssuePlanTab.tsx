import { Loader2 } from 'lucide-react'
import type { Components } from 'react-markdown'
import { MarkdownPreviewBody } from '@/components/editor/MarkdownPreviewBody'
import { useDocumentDarkTheme } from '@/hooks/use-document-dark-theme'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { loginOf } from '../../build-web-labels'
import { planProgress } from './issue-file-roles'
import type { IssuePlan } from './use-issue-plan'

// A link of the plan opens in the browser; the card itself never navigates.
const PLAN_COMPONENTS: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault()
        if (href && /^https?:\/\//i.test(href)) {
          void window.api.shell.openUrl(href)
        }
      }}
    >
      {children}
    </a>
  )
}

/** How to attach what an empty tab is for, as build-web says it. */
export function AttachHint({ text, command }: { text: string; command: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
      <span>{text}</span>
      <code className="font-mono text-xs">{command}</code>
    </div>
  )
}

/**
 * The task's plan, drawn from its markdown. Read only, as in build-web: the plan lives in the
 * agent's `.claude/plans/` and is attached again after each change.
 */
export function IssuePlanTab({
  issueKey,
  plan
}: {
  issueKey: string
  plan: IssuePlan
}): React.JSX.Element {
  const { plans, shown, text, error } = plan
  const isDark = useDocumentDarkTheme()
  if (!shown) {
    return (
      <AttachHint
        text={translate('buildWeb.plan.none', 'The task has no plan. Attach one with')}
        command={`bw.sh attach ${issueKey} <plan.md> --plan`}
      />
    )
  }
  const progress = text ? planProgress(text) : null
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {plans.length > 1 ? (
          <Select value={shown.id} onValueChange={plan.choose}>
            <SelectTrigger size="sm" aria-label={translate('buildWeb.plan.file', 'Plan file')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="font-mono">{shown.name}</span>
        )}
        <span>
          · {loginOf(shown.created_by)} · {new Date(shown.created_at).toLocaleString()}
        </span>
      </div>
      {progress && progress.total > 0 ? (
        <div className="flex items-center gap-3">
          <Progress
            value={(progress.done / progress.total) * 100}
            aria-label={translate('buildWeb.plan.progress', 'Plan progress')}
            className="flex-1"
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {translate('buildWeb.plan.done', '{{done}} of {{total}} done', progress)}
          </span>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {text === null && !error ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : null}
      {text !== null ? (
        // The look of a Markdown file's preview: a plan's steps read as checkboxes, not bullets.
        <div className={isDark ? 'markdown-dark' : 'markdown-light'}>
          <div className="markdown-body">
            <MarkdownPreviewBody content={text} components={PLAN_COMPONENTS} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
