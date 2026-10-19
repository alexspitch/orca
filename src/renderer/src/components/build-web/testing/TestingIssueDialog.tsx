import { useEffect, useRef } from 'react'
import * as VisuallyHidden from 'radix-ui/visually-hidden'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { useBuildWebStore } from '../build-web-store'
import { BuildWebTakeToWorkDialog } from '../BuildWebTakeToWorkDialog'
import { BuildWebIssueFullScreen } from '../issue/BuildWebIssueFullScreen'
import { useTakeToWork } from '../use-take-to-work'

/**
 * The task card over the Testing list, so the list stays where it was. Any way the card closes —
 * Escape, its collapse or back button, a move out of it — reads the list again.
 */
export function TestingIssueDialog({ onClosed }: { onClosed: () => void }): React.JSX.Element {
  const openIssueId = useBuildWebStore((s) => s.openIssueId)
  const { taking, takeToWork, closeTaking } = useTakeToWork()
  const open = openIssueId !== null
  const wasOpen = useRef(false)
  const closed = useRef(onClosed)
  closed.current = onClosed

  useEffect(() => {
    if (wasOpen.current && !open) {
      closed.current()
    }
    wasOpen.current = open
  }, [open])
  // Why on leaving: Issues opens on its list, not on a card picked here.
  useEffect(() => () => useBuildWebStore.getState().openIssue(null), [])

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => !next && useBuildWebStore.getState().openIssue(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="flex h-[88vh] flex-col overflow-hidden sm:max-w-[min(1280px,94vw)]"
        >
          <VisuallyHidden.Root asChild>
            <DialogTitle>{translate('buildWeb.detail.task', 'Task')}</DialogTitle>
          </VisuallyHidden.Root>
          <VisuallyHidden.Root asChild>
            <DialogDescription>
              {translate('buildWeb.testing.cardHint', 'The task card, over the Testing list')}
            </DialogDescription>
          </VisuallyHidden.Root>
          {openIssueId ? (
            <BuildWebIssueFullScreen key={openIssueId} onTakeToWork={takeToWork} />
          ) : null}
        </DialogContent>
      </Dialog>
      <BuildWebTakeToWorkDialog issues={taking} onClose={closeTaking} />
    </>
  )
}
