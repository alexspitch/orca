import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useRef, useState } from 'react'

// Why app storage, not localStorage: the shell's WebView has DOM storage off on Android and
// per-session on iOS. One key per host holds every build-web console seen through it.

export function recordOf(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? Object.fromEntries(Object.entries(raw)) : {}
}

async function readRecord(key: string): Promise<Record<string, unknown>> {
  try {
    return recordOf(JSON.parse((await AsyncStorage.getItem(key)) ?? 'null'))
  } catch {
    return {}
  }
}

let writes: Promise<void> = Promise.resolve()

// Serialized so two quick changes never both merge into the same stale record.
function writeEntry(key: string, entry: string, value: unknown): void {
  writes = writes.then(async () => {
    try {
      const record = await readRecord(key)
      await AsyncStorage.setItem(key, JSON.stringify({ ...record, [entry]: value }))
    } catch {
      // A refused write only means the tabs won't survive a restart.
    }
  })
}

/** A per-console list kept in app storage; empty until read, and a change made first wins. */
export function useStoredHostTabs<T>(
  storageKey: string,
  entry: string,
  parse: (raw: unknown) => T[]
) {
  const scope = `${storageKey}|${entry}`
  const [held, setHeld] = useState<{ scope: string; tabs: readonly T[] }>({ scope, tabs: [] })
  const tabs = held.scope === scope ? held.tabs : []
  const latest = useRef(tabs)
  latest.current = tabs
  const changed = useRef<string | null>(null)
  const parseRef = useRef(parse)
  parseRef.current = parse

  useEffect(() => {
    let alive = true
    void readRecord(storageKey).then((record) => {
      if (alive && changed.current !== scope) {
        setHeld({ scope, tabs: parseRef.current(record[entry]) })
      }
    })
    return () => {
      alive = false
    }
  }, [entry, scope, storageKey])

  const update = useCallback(
    (change: (current: readonly T[]) => readonly T[]) => {
      const next = change(latest.current)
      if (next === latest.current) {
        return
      }
      latest.current = next
      changed.current = scope
      setHeld({ scope, tabs: next })
      writeEntry(storageKey, entry, next)
    },
    [entry, scope, storageKey]
  )

  return [tabs, update] as const
}
