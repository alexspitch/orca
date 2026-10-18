import { useCallback, useRef, useState } from 'react'
import type React from 'react'
import { GIT_LOG_SPLIT_MAX, GIT_LOG_SPLIT_MIN } from './git-log-view-prefs'

/**
 * The rule between the changed files and the commit details: a share of the column's height,
 * dragged with the mouse or moved with the arrow keys. `onCommit` stores the final share.
 */
export function useGitLogDetailsSplit(
  initialShare: number,
  onCommit: (share: number) => void
): {
  share: number
  columnRef: React.RefObject<HTMLDivElement | null>
  onRuleMouseDown: (event: React.MouseEvent) => void
  onRuleKeyDown: (event: React.KeyboardEvent) => void
} {
  const [share, setShare] = useState(initialShare)
  const columnRef = useRef<HTMLDivElement>(null)
  const clamp = (value: number) => Math.min(GIT_LOG_SPLIT_MAX, Math.max(GIT_LOG_SPLIT_MIN, value))

  const onRuleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      const column = columnRef.current
      if (!column || event.button !== 0) {
        return
      }
      event.preventDefault()
      const rect = column.getBoundingClientRect()
      let latest = share
      const onMove = (move: MouseEvent) => {
        latest = clamp((move.clientY - rect.top) / rect.height)
        setShare(latest)
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        onCommit(latest)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [onCommit, share]
  )

  const onRuleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const step = event.key === 'ArrowUp' ? -0.05 : event.key === 'ArrowDown' ? 0.05 : 0
      if (step) {
        event.preventDefault()
        const next = clamp(share + step)
        setShare(next)
        onCommit(next)
      }
    },
    [onCommit, share]
  )

  return { share, columnRef, onRuleMouseDown, onRuleKeyDown }
}
