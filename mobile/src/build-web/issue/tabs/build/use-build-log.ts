import { useEffect, useRef, useState } from 'react'
import { cleanLogPiece } from '../../../../../../src/shared/build-log-clean'
import { buildWebErrorMessage } from '../../../build-web-operations'
import { useBuildWebScreen } from '../../../build-web-screen-context'

// The desktop's useBuildLog: a Jenkins log read piece by piece until the build is over.

const IDLE_POLL_MS = 1500
const RETRY_MS = 5000
// Why a cap: a long Jenkins log would otherwise grow without end; the tail is what is read.
const KEEP_LINES = 20_000
export type BuildLogState = {
  lines: readonly string[]
  done: boolean
  trimmed: boolean
  error: string | null
}
const EMPTY: BuildLogState = { lines: [''], done: false, trimmed: false, error: null }

/** The piece's lines added on: its first one ends the line the last piece left open. */
function appendLines(lines: readonly string[], text: string): string[] {
  const [first = '', ...rest] = text.split('\n')
  return [...lines.slice(0, -1), (lines.at(-1) ?? '') + first, ...rest]
}

/** Mount once per log (key by its URL): the reads continue from where the last one ended. */
export function useBuildLog(url: string): BuildLogState {
  const { call } = useBuildWebScreen()
  const [state, setState] = useState<BuildLogState>(EMPTY)
  // The next read: its turn and how long to wait for it; null once the build is over.
  const [turn, setTurn] = useState(0)
  const [wait, setWait] = useState<number | null>(null)
  const offset = useRef(0)
  // An escape sequence cut at the end of a piece waits for the rest in the next one.
  const carry = useRef('')

  useEffect(() => {
    let alive = true
    call('buildLog', { url, offset: offset.current }).then(
      (piece) => {
        if (!alive) {
          return
        }
        offset.current = piece.next
        const next = cleanLogPiece(carry.current, piece.text, piece.done)
        carry.current = next.carry
        setState((current) => {
          const lines = next.text ? appendLines(current.lines, next.text) : current.lines
          const trimmed = current.trimmed || lines.length > KEEP_LINES
          return { lines: lines.slice(-KEEP_LINES), done: piece.done, trimmed, error: null }
        })
        // Catch up quickly while there is text; poll slowly once the log is idle.
        setWait(piece.done ? null : next.text ? 50 : IDLE_POLL_MS)
      },
      (failure: unknown) => {
        if (alive) {
          setState((current) => ({ ...current, error: buildWebErrorMessage(failure) }))
          // Why again: the read is by offset, so a dropped connection resumes where it stopped.
          setWait(RETRY_MS)
        }
      }
    )
    return () => {
      alive = false
    }
  }, [call, turn, url])

  useEffect(() => {
    if (wait === null) {
      return
    }
    const timer = setTimeout(() => {
      setWait(null)
      setTurn((n) => n + 1)
    }, wait)
    return () => clearTimeout(timer)
  }, [wait])

  return state
}
