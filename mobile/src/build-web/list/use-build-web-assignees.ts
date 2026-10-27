import { useEffect, useState } from 'react'
import type { BuildWebUser } from '../../../../src/shared/build-web-types'
import { useBuildWebScreen } from '../build-web-screen-context'

/** The people a task can be assigned to, read once while enabled; empty until it answers. */
export function useBuildWebAssignees(enabled: boolean): BuildWebUser[] {
  const { call } = useBuildWebScreen()
  const [users, setUsers] = useState<BuildWebUser[] | null>(null)
  const loaded = users !== null
  useEffect(() => {
    if (!enabled || loaded) {
      return
    }
    let alive = true
    void call('listAssignees')
      .then((answer) => {
        if (alive) {
          setUsers(answer)
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [call, enabled, loaded])
  return users ?? []
}
