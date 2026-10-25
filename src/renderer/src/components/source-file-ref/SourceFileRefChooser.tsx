import { create } from 'zustand'
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
import { openSourceFileRefPath, type SourceFileRefScope } from './source-file-ref-open'

// One chooser for every surface: a rich editor's inline code has no React element to hang a menu on.

export type SourceFileRefChoice = {
  /** Viewport point the menu opens at: the clicked reference's bottom-left corner. */
  at: { x: number; y: number }
  scope: SourceFileRefScope
  ref: SourceFileRef
  paths: string[]
}

const useSourceFileRefChoice = create<{ choice: SourceFileRefChoice | null }>(() => ({
  choice: null
}))

export function offerSourceFileRefPaths(choice: SourceFileRefChoice): void {
  useSourceFileRefChoice.setState({ choice })
}

const close = (): void => useSourceFileRefChoice.setState({ choice: null })

export function SourceFileRefChooser(): React.JSX.Element | null {
  const choice = useSourceFileRefChoice((s) => s.choice)
  if (!choice) {
    return null
  }
  return (
    <DropdownMenu open onOpenChange={(open) => !open && close()}>
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          className="pointer-events-none fixed size-0"
          style={{ left: choice.at.x, top: choice.at.y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-[min(36rem,90vw)]">
        <DropdownMenuLabel>
          {translate('sourceFileRef.choose', '{{count}} files match', {
            count: choice.paths.length
          })}
        </DropdownMenuLabel>
        {choice.paths.map((path) => (
          <DropdownMenuItem
            key={path}
            onSelect={() =>
              void openSourceFileRefPath(choice.scope, path, choice.ref).catch((failure: unknown) =>
                toast.error(failure instanceof Error ? failure.message : String(failure))
              )
            }
          >
            <span className="truncate font-mono text-xs">{path}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
