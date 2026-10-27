import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable } from 'react-native'
import type {
  BuildWebImageFreshness,
  BuildWebImageRow
} from '../../../../src/shared/build-web-image-types'
import type { ChipTone } from '../../../../src/renderer/src/components/build-web/build-web-tones'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { colors } from '../../theme/mobile-theme'
import { useBuildWebScreen } from '../build-web-screen-context'
import { BuildWebToneChip } from '../BuildWebToneChip'

// Whether an image of one product version holds its branch's latest changes, from the console's
// sync scan. Asked only with a version picked: the host then knows the version's own branch.

type Scope = { product: string; dist: 'rhel' | 'redos' }
type Scan =
  | { state: 'loading' }
  | { state: 'done'; value: BuildWebImageFreshness | null }
  | { state: 'failed' }

const scopeKey = (s: Scope): string => JSON.stringify([s.product, s.dist])

function scopeOf(row: BuildWebImageRow): Scope | null {
  const dist = row.last?.dist
  return dist === 'rhel' || dist === 'redos' ? { product: row.product, dist } : null
}

export type ImageFreshness = {
  /** The flag is worth a place: a version is picked, the right is there, a scan can answer. */
  shown: boolean
  of: (row: BuildWebImageRow) => Scan | null
}

/**
 * The scans behind the rows of a picked version, one per product and dist. Asked again when a
 * row's build changes (one finished) and on `refreshes` — then past the host's copy too.
 */
export function useImageFreshness(
  rows: readonly BuildWebImageRow[],
  version: string | null,
  refreshes: number
): ImageFreshness {
  const { call, status } = useBuildWebScreen()
  const canSync = status.perms.includes('sync')
  const scopes = useMemo(() => {
    const byKey = new Map<string, Scope>()
    if (version && canSync) {
      for (const row of rows) {
        const scope = scopeOf(row)
        if (scope) {
          byKey.set(scopeKey(scope), scope)
        }
      }
    }
    return byKey
  }, [canSync, rows, version])
  // Why strings: rows are a new array on every reload; only a changed build is worth a scan.
  const wanted = [...scopes.keys()].sort().join('\n')
  const signature = rows
    .map((r) => `${r.image}|${r.last?.number ?? ''}|${r.last?.status ?? ''}`)
    .join('\n')
  const [byScope, setByScope] = useState<Record<string, Scan>>({})
  const last = useRef<{ signature: string; refreshes: number } | null>(null)
  const scopesRef = useRef(scopes)
  scopesRef.current = scopes
  useEffect(() => {
    if (!version || !wanted) {
      return
    }
    const before = last.current
    last.current = { signature, refreshes }
    const force =
      before !== null && (before.signature !== signature || before.refreshes !== refreshes)
    let alive = true
    const put = (key: string, scan: Scan) =>
      alive && setByScope((current) => ({ ...current, [key]: scan }))
    for (const [key, scope] of scopesRef.current) {
      // Why every time: a rescan replaces the flag, so the old one must not read as the answer.
      put(key, { state: 'loading' })
      call('imageFreshness', { ...scope, version, force }).then(
        (value) => put(key, { state: 'done', value }),
        () => put(key, { state: 'failed' })
      )
    }
    return () => {
      alive = false
    }
  }, [call, refreshes, signature, version, wanted])
  const asked = [...scopes.keys()].map((key) => byScope[key])
  return {
    shown: asked.some((scan) => scan !== undefined && scan.state !== 'failed'),
    of: (row) => {
      const scope = scopeOf(row)
      return scope ? (byScope[scopeKey(scope)] ?? null) : null
    }
  }
}

/** The row's flag: to rebuild for its own code or for packages only; current; or never built. */
export function FreshnessChip({ row, scan }: { row: BuildWebImageRow; scan: Scan | null }) {
  const { notify } = useBuildWebScreen()
  if (scan?.state === 'loading') {
    return <LoadingSpinner size={12} color={colors.textMuted} />
  }
  if (scan?.state !== 'done' || !scan.value) {
    return null
  }
  const flag = flagOf(row.image, scan.value)
  if (!flag) {
    return null
  }
  // Why a press: the desktop's tooltip says why; a phone has no hover to show it.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${flag.label}: ${flag.why}`}
      hitSlop={6}
      onPress={() => notify(flag.why)}
    >
      <BuildWebToneChip label={flag.label} tone={flag.tone} />
    </Pressable>
  )
}

function flagOf(
  image: string,
  scan: BuildWebImageFreshness
): { label: string; tone: ChipTone | null; why: string } | null {
  const { rebuild, current, neverBuilt, branch } = scan
  const change = Object.hasOwn(rebuild, image) ? rebuild[image] : undefined
  if (change) {
    const what = change.changed.join(', ') || 'its sources'
    // Why two flags: its own code changed is a sure rebuild; a shared package may not reach it.
    return change.kind === 'app'
      ? {
          label: 'rebuild',
          tone: 'amber',
          why: `Its own code changed on ${branch} since its last build: ${what}`
        }
      : {
          label: 'packages',
          tone: 'sky',
          why: `Only shared packages it is built with changed on ${branch} since its last build: ${what}`
        }
  }
  if (current.includes(image)) {
    return {
      label: 'current',
      tone: null,
      why: `Nothing it is built from changed on ${branch} since its last build`
    }
  }
  if (neverBuilt.includes(image)) {
    return { label: 'not built', tone: null, why: `No build of this version on ${branch} yet` }
  }
  return null
}
