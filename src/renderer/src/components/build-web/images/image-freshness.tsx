import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type {
  BuildWebImageFreshness,
  BuildWebImageRow
} from '../../../../../shared/build-web-image-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { useBuildWebStore } from '../build-web-store'
import { BuildWebToneChip } from '../BuildWebToneChip'

// Whether an image of one product version holds its branch's latest changes, from the console's
// sync scan. Asked only with a version picked: main then knows the version's own branch.

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

const targetKeyOf = (target: RuntimeClientTarget): string =>
  target.kind === 'environment' ? `environment:${target.environmentId}` : target.kind

export type ImageFreshness = {
  /** The column is worth a place: a version is picked, the right is there, a scan can answer. */
  shown: boolean
  of: (row: BuildWebImageRow) => Scan | null
}

/**
 * The scans behind the rows of a picked version, one per product and dist. Asked again when a
 * row's build changes (one finished) and on `refreshes` — then past main's copy too.
 */
export function useImageFreshness(
  target: RuntimeClientTarget,
  rows: readonly BuildWebImageRow[],
  version: string | null,
  refreshes: number
): ImageFreshness {
  const canSync = useBuildWebStore((s) => s.status?.perms.includes('sync') === true)
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
  const builds = rows.map((r) => `${r.image}|${r.last?.number ?? ''}|${r.last?.status ?? ''}`)
  const signature = builds.join('\n')
  const targetKey = targetKeyOf(target)
  const [scans, setScans] = useState<{ targetKey: string; byScope: Record<string, Scan> }>({
    targetKey,
    byScope: {}
  })
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
      alive &&
      setScans((current) => ({
        targetKey,
        byScope: { ...(current.targetKey === targetKey ? current.byScope : {}), [key]: scan }
      }))
    for (const [key, scope] of scopesRef.current) {
      // Why every time: a rescan replaces the flag, so the old one must not read as the answer.
      put(key, { state: 'loading' })
      void callBuildWeb(target, 'imageFreshness', { ...scope, version, force }).then(
        (value) => put(key, { state: 'done', value }),
        () => put(key, { state: 'failed' })
      )
    }
    return () => {
      alive = false
    }
  }, [refreshes, signature, target, targetKey, version, wanted])
  const byScope = scans.targetKey === targetKey ? scans.byScope : {}
  const asked = [...scopes.keys()].map((key) => byScope[key])
  return {
    shown: asked.some((scan) => scan !== undefined && scan.state !== 'failed'),
    of: (row) => {
      const scope = scopeOf(row)
      return scope ? (byScope[scopeKey(scope)] ?? null) : null
    }
  }
}

/** The row's flag: to rebuild for its own code or for packages only; current; or never built on the version. */
export function FreshnessCell({
  row,
  scan
}: {
  row: BuildWebImageRow
  scan: Scan | null
}): React.JSX.Element | null {
  if (scan?.state === 'loading') {
    return (
      <Loader2
        className="size-3.5 animate-spin text-muted-foreground"
        aria-label={translate('buildWeb.images.freshnessLoading', 'Checking for changes…')}
      />
    )
  }
  if (scan?.state !== 'done' || !scan.value) {
    return null
  }
  const { rebuild, current, neverBuilt, branch } = scan.value
  if (Object.hasOwn(rebuild, row.image)) {
    const { kind, changed } = rebuild[row.image]
    const what = changed.join(', ') || translate('buildWeb.images.rebuildSources', 'its sources')
    // Why two flags: its own code changed is a sure rebuild; a shared package may not reach it.
    return kind === 'app' ? (
      <BuildWebToneChip
        label={translate('buildWeb.images.rebuild', 'rebuild')}
        tone="amber"
        title={translate(
          'buildWeb.images.rebuildTip',
          'Its own code changed on {{branch}} since its last build: {{what}}',
          { branch, what }
        )}
      />
    ) : (
      <BuildWebToneChip
        label={translate('buildWeb.images.rebuildPackages', 'packages')}
        tone="sky"
        title={translate(
          'buildWeb.images.rebuildPackagesTip',
          'Only shared packages it is built with changed on {{branch}} since its last build: {{what}}',
          { branch, what }
        )}
      />
    )
  }
  if (current.includes(row.image)) {
    return (
      <BuildWebToneChip
        label={translate('buildWeb.images.current', 'current')}
        tone={null}
        title={translate(
          'buildWeb.images.currentTip',
          'Nothing it is built from changed on {{branch}} since its last build',
          { branch }
        )}
      />
    )
  }
  if (neverBuilt.includes(row.image)) {
    return (
      <BuildWebToneChip
        label={translate('buildWeb.images.neverBuilt', 'not built')}
        tone={null}
        title={translate(
          'buildWeb.images.neverBuiltTip',
          'No build of this version on {{branch}} yet',
          {
            branch
          }
        )}
      />
    )
  }
  return null
}
