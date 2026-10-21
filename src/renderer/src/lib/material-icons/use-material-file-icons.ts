import { useEffect, useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import { useDocumentDarkTheme } from '@/hooks/use-document-dark-theme'
import {
  materialIconFile,
  materialIconName,
  type MaterialIconKind,
  type MaterialIconManifest
} from './material-icon-resolve'

type MaterialIconSet = { manifest: MaterialIconManifest; urls: ReadonlyMap<string, string> }

// Why module-level: every Explorer row reads the same set, loaded once and only when chosen.
let loaded: MaterialIconSet | null = null
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

function ensureLoaded(): void {
  loading ??= Promise.all([
    import('material-icon-theme/dist/material-icons.json'),
    import('./material-icon-urls')
  ])
    .then(([manifest, icons]) => {
      loaded = { manifest: manifest.default, urls: icons.MATERIAL_ICON_URLS }
      listeners.forEach((listener) => listener())
    })
    .catch((error: unknown) => {
      // Why retry later: a failed chunk load keeps Orca's own icons, not none.
      loading = null
      console.warn('[file-icons] Material Icon Theme failed to load', error)
    })
}

const readLoaded = (): MaterialIconSet | null => loaded

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * A file's or folder's Material Icon Theme URL when that theme is chosen in Settings, else null —
 * also until the theme has loaded, so the caller draws Orca's own icon meanwhile.
 */
export function useMaterialFileIcon(name: string, kind: MaterialIconKind): string | null {
  const on = useAppStore((s) => s.settings?.fileIconTheme === 'material')
  const dark = useDocumentDarkTheme()
  const set = useSyncExternalStore(subscribe, readLoaded, readLoaded)
  useEffect(() => {
    if (on) {
      ensureLoaded()
    }
  }, [on])
  if (!on || !set) {
    return null
  }
  const file = materialIconFile(set.manifest, materialIconName(set.manifest, name, kind, !dark))
  return file ? (set.urls.get(file) ?? null) : null
}
