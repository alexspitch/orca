import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { SourceFileRef } from './source-file-ref'
import {
  findSourceFileRefPaths,
  openSourceFileRefPath,
  sourceFileRefScopeOf
} from './source-file-ref-open'
import { offerSourceFileRefPaths } from './SourceFileRefChooser'
import { armLinkReturn } from '@/components/link-return/link-return-arm'

const message = (failure: unknown) => (failure instanceof Error ? failure.message : String(failure))

/** Open the one file the reference means at its line, or offer the several it can mean. */
export async function activateSourceFileRef(
  ref: SourceFileRef,
  worktreeId: string | null | undefined,
  anchor: DOMRect
): Promise<void> {
  const scope = sourceFileRefScopeOf(worktreeId)
  if (!scope) {
    toast.error(
      translate('sourceFileRef.noWorktree', 'Open a worktree to find {{path}} in', {
        path: ref.path
      })
    )
    return
  }
  try {
    const paths = await findSourceFileRefPaths(scope, ref)
    if (paths.length === 1) {
      armLinkReturn()
      await openSourceFileRefPath(scope, paths[0], ref)
    } else if (paths.length > 1) {
      offerSourceFileRefPaths({ at: { x: anchor.left, y: anchor.bottom }, scope, ref, paths })
    } else {
      toast.error(
        translate('sourceFileRef.notFound', 'No {{path}} in {{root}}', {
          path: ref.path,
          root: scope.root
        })
      )
    }
  } catch (failure) {
    toast.error(message(failure))
  }
}
