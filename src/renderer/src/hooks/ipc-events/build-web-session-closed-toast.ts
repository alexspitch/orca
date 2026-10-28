import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { RuntimeClientEvent } from '../../../../shared/runtime-client-events'

type BuildWebSessionClosed = Extract<RuntimeClientEvent, { type: 'buildWebSessionClosed' }>

/** The host removed a closed task's empty worktree (IS-147); the host decides, this only tells. */
export function showBuildWebSessionClosedToast({ key, worktreeId }: BuildWebSessionClosed): void {
  toast.info(
    translate('buildWeb.session.closedRemoved', '{{key}} closed: workspace removed', { key }),
    { id: `build-web-session-closed:${worktreeId}` }
  )
}
