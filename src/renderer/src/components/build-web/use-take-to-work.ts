import { useState } from 'react'
import type { BuildWebIssueRow } from '../../../../shared/build-web-types'
import { openNamedTaskSession } from './build-web-task-session'

/** «Take to work»: the session already named after the tasks when one is open, else the dialog that starts one. */
export function useTakeToWork(): {
  taking: BuildWebIssueRow[] | null
  takeToWork: (picked: BuildWebIssueRow[]) => void
  closeTaking: () => void
} {
  const [taking, setTaking] = useState<BuildWebIssueRow[] | null>(null)
  const takeToWork = (picked: BuildWebIssueRow[]): void => {
    if (!openNamedTaskSession(picked)) {
      setTaking(picked)
    }
  }
  return { taking, takeToWork, closeTaking: () => setTaking(null) }
}
