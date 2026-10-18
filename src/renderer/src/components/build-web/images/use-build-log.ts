import { useEffect, useState } from 'react'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'

const IDLE_POLL_MS = 1500
// Why a cap: a long Jenkins log would otherwise grow the page without end; the tail is what is read.
const KEEP_CHARS = 1_500_000
// eslint-disable-next-line no-control-regex -- the escape character is exactly what is matched.
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g
// eslint-disable-next-line no-control-regex -- an escape with no final byte yet, at the very end.
const PARTIAL_ESCAPE = /\u001b(\[[0-9;?]*[ -/]*)?$/

/** A piece without colour codes; a code cut at its end is carried into the next piece. */
export function cleanLogPiece(
  carry: string,
  text: string,
  done: boolean
): { text: string; carry: string } {
  const raw = carry + text
  const cut = done ? null : PARTIAL_ESCAPE.exec(raw)
  const kept = cut ? raw.slice(0, cut.index) : raw
  return { text: kept.replace(ANSI, ''), carry: cut ? cut[0] : '' }
}

type LogState = { text: string; done: boolean; trimmed: boolean; error: string | null }
const EMPTY: LogState = { text: '', done: false, trimmed: false, error: null }

/** A build log read piece by piece from where the last read ended, until the build is over. */
export function useBuildLog(target: RuntimeClientTarget, url: string | null): LogState {
  const [state, setState] = useState<LogState>(EMPTY)
  useEffect(() => {
    setState(EMPTY)
    if (!url) {
      return
    }
    let alive = true
    let timer = 0
    let offset = 0
    // An escape sequence cut at the end of a piece waits for the rest in the next one.
    let carry = ''
    const read = async (): Promise<void> => {
      try {
        const piece = await callBuildWeb(target, 'buildLog', { url, offset })
        if (!alive) {
          return
        }
        offset = piece.next
        const next = cleanLogPiece(carry, piece.text, piece.done)
        carry = next.carry
        const added = next.text
        setState((current) => {
          const text = current.text + added
          const trimmed = current.trimmed || text.length > KEEP_CHARS
          return { text: text.slice(-KEEP_CHARS), done: piece.done, trimmed, error: null }
        })
        if (!piece.done) {
          // Catch up quickly while there is text; poll slowly once the log is idle.
          timer = window.setTimeout(() => void read(), added ? 50 : IDLE_POLL_MS)
        }
      } catch (failure) {
        if (alive) {
          setState((current) => ({
            ...current,
            error: failure instanceof Error ? failure.message : String(failure)
          }))
        }
      }
    }
    void read()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [target, url])
  return state
}
