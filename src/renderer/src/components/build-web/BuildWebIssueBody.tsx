import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import { translate } from '@/i18n/i18n'
import type { BuildWebIssueDetail } from '../../../../shared/build-web-types'

// Why `compact`: task text comes from build-web's users; untrusted images become links rather
// than loading by themselves (tracking pixels, intranet requests from this machine).

export function BuildWebIssueDescription({
  detail
}: {
  detail: BuildWebIssueDetail
}): React.JSX.Element {
  return detail.description.trim() ? (
    <CommentMarkdown content={detail.description} variant="compact" className="text-sm" />
  ) : (
    <p className="text-sm text-muted-foreground">
      {translate('buildWeb.detail.noDescription', 'No description.')}
    </p>
  )
}

export function BuildWebIssueSteps({
  detail
}: {
  detail: BuildWebIssueDetail
}): React.JSX.Element | null {
  const steps = detail.steps
    .map((s, n) => ({
      id: `step-${n}`,
      text: s.text ?? [s.action, s.expected].filter(Boolean).join(' → ')
    }))
    .filter((s) => s.text)
  if (steps.length === 0) {
    return null
  }
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm">
      {steps.map((step) => (
        <li key={step.id}>{step.text}</li>
      ))}
    </ol>
  )
}

export function BuildWebIssueComments({
  detail
}: {
  detail: BuildWebIssueDetail
}): React.JSX.Element {
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
        <li key={c.id} className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {c.author} · {new Date(c.created_at).toLocaleString()}
          </span>
          <CommentMarkdown content={c.body} variant="compact" className="text-sm" />
        </li>
      ))}
    </ul>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  )
}
