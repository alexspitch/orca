import { useEffect, useRef } from 'react'
import type { LiveReads, LiveReadWatch } from '../../../src/shared/build-web-live-reads'

// Why a copy of the desktop's use-live-read.ts: a hook outside mobile/ would load the desktop's React.

/**
 * Follows `key` in `reads` while mounted and `key` is set; reads only while `visible`. The newest
 * `read` and `onValue` are the ones called.
 */
export function useLiveRead<T>(
  reads: LiveReads<T>,
  key: string | null,
  visible: boolean,
  read: () => Promise<T>,
  onValue: (value: T, issuedAt: number) => void,
  everyMs?: number
): void {
  const latest = useRef({ read, onValue, visible })
  latest.current = { read, onValue, visible }
  const watch = useRef<LiveReadWatch | null>(null)
  useEffect(() => {
    if (!key) {
      return
    }
    const own = reads.watch(key, {
      read: () => latest.current.read(),
      onValue: (value, issuedAt) => latest.current.onValue(value, issuedAt),
      visible: latest.current.visible,
      everyMs
    })
    watch.current = own
    return () => {
      own.stop()
      watch.current = null
    }
  }, [everyMs, key, reads])
  useEffect(() => {
    watch.current?.setVisible(visible)
  }, [visible])
}
