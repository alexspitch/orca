import { useState } from 'react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import type { SourceFileRef } from './source-file-ref'
import {
  findSourceFileRefPaths,
  openSourceFileRefPath,
  sourceFileRefScopeOf,
  type SourceFileRefScope
} from './source-file-ref-open'

const message = (failure: unknown) => (failure instanceof Error ? failure.message : String(failure))

type Choice = { scope: SourceFileRefScope; paths: string[] }

/**
 * Inline code naming a source file: a click opens it at the line in the worktree; several files
 * of that name are offered to choose from.
 */
export function SourceFileRefCode({
  text,
  sourceRef,
  worktreeId
}: {
  text: string
  sourceRef: SourceFileRef
  /** Read at the click: the worktree may be opened after the text is drawn. */
  worktreeId: () => string | null | undefined
}): React.JSX.Element {
  const [choice, setChoice] = useState<Choice | null>(null)
  const [busy, setBusy] = useState(false)

  const open = (scope: SourceFileRefScope, path: string): void => {
    openSourceFileRefPath(scope, path, sourceRef).catch((failure: unknown) =>
      toast.error(message(failure))
    )
  }

  const resolve = async (): Promise<void> => {
    const scope = sourceFileRefScopeOf(worktreeId())
    if (!scope) {
      toast.error(
        translate('sourceFileRef.noWorktree', 'Open a worktree to find {{path}} in', {
          path: sourceRef.path
        })
      )
      return
    }
    setBusy(true)
    try {
      const paths = await findSourceFileRefPaths(scope, sourceRef)
      if (paths.length === 1) {
        open(scope, paths[0])
      } else if (paths.length > 1) {
        setChoice({ scope, paths })
      } else {
        toast.error(
          translate('sourceFileRef.notFound', 'No {{path}} in {{root}}', {
            path: sourceRef.path,
            root: scope.root
          })
        )
      }
    } catch (failure) {
      toast.error(message(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu open={choice !== null} onOpenChange={(next) => !next && setChoice(null)}>
      <DropdownMenuTrigger asChild>
        <code
          role="link"
          tabIndex={0}
          aria-busy={busy}
          title={translate('sourceFileRef.open', 'Open {{path}} in the worktree', {
            path: sourceRef.path
          })}
          className="cursor-pointer underline decoration-dotted underline-offset-2 hover:decoration-solid"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            if (!busy) {
              void resolve()
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !busy) {
              event.preventDefault()
              void resolve()
            }
          }}
        >
          {text}
        </code>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-[min(36rem,90vw)]">
        <DropdownMenuLabel>
          {translate('sourceFileRef.choose', '{{count}} files match', {
            count: choice?.paths.length ?? 0
          })}
        </DropdownMenuLabel>
        {choice?.paths.map((path) => (
          <DropdownMenuItem key={path} onSelect={() => open(choice.scope, path)}>
            <span className="truncate font-mono text-xs">{path}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
