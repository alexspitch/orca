import { createContext, useContext } from 'react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { sourceFileRefOfCode, type SourceFileRef } from './source-file-ref'

/**
 * The worktree a surface's file references resolve in, read at the click. Absent, inline code
 * stays plain: only the surfaces that provide it turn references into links.
 */
export const SourceFileRefWorktreeContext = createContext<(() => string | null | undefined) | null>(
  null
)

/** Inline code naming a source file: a click opens it at the line in the worktree. */
export function SourceFileRefCode({
  text,
  sourceRef,
  worktreeId,
  className
}: {
  text: string
  sourceRef: SourceFileRef
  /** Read at the click: the worktree may be opened after the text is drawn. */
  worktreeId: () => string | null | undefined
  className?: string
}): React.JSX.Element {
  const activate = (target: HTMLElement): void => {
    const at = target.getBoundingClientRect()
    // Why lazy: every chat message renders this; the lookup pulls in the file and store routing.
    void import('./source-file-ref-activate').then(({ activateSourceFileRef }) =>
      activateSourceFileRef(sourceRef, worktreeId(), at)
    )
  }
  return (
    <code
      role="link"
      tabIndex={0}
      title={translate('sourceFileRef.open', 'Open {{path}} in the worktree', {
        path: sourceRef.path
      })}
      className={cn(
        className,
        'cursor-pointer underline decoration-dotted underline-offset-2 hover:decoration-solid'
      )}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        activate(event.currentTarget)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          activate(event.currentTarget)
        }
      }}
    >
      {text}
    </code>
  )
}

/** The reference-aware inline code of a surface that provides a worktree; null leaves it plain. */
export function useSourceFileRefCode(
  className: string | undefined,
  children: React.ReactNode,
  codeClassName?: string
): React.JSX.Element | null {
  const worktreeId = useContext(SourceFileRefWorktreeContext)
  const sourceRef = worktreeId ? sourceFileRefOfCode(className, children) : null
  return worktreeId && sourceRef ? (
    <SourceFileRefCode
      text={sourceRef.text}
      sourceRef={sourceRef.ref}
      worktreeId={worktreeId}
      className={codeClassName}
    />
  ) : null
}
