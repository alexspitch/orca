import { useState } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { ExternalLink, Hammer } from 'lucide-react-native'
import type {
  BuildWebImageBuild,
  BuildWebImageSort
} from '../../../../src/shared/build-web-image-types'
import { pushesGoing } from '../../../../src/shared/build-web-image-tracking'
import { imageRefOf } from '../../../../src/renderer/src/components/build-web/images/image-links'
import { useImagePicks } from './use-image-picks'
import { openExternalLink } from '../../platform/external-link'
import { spacing, typography, colors } from '../../theme/mobile-theme'
import { useBuildWebScreen } from '../build-web-screen-context'
import { BuildWebToneChip } from '../BuildWebToneChip'
import { BuildTabButton, BuildTabTick } from '../issue/tabs/build/BuildTabControls'
import { SelectField } from '../issue/tabs/build/BuildPickers'
import { ImageActionBar } from './ImageActionBar'
import type { ImageBuildChoice } from './ImageBuildSheet'
import {
  BuildStatusChip,
  LogLink,
  RegistryChip,
  buildStatusLabel,
  formatBuildTime,
  type OpenImageLog
} from './image-cells'
import { ImageFilterChips } from './ImageFilterChips'
import { ImageRunCards } from './ImageRunCards'
import { useImageTracking } from './image-tracking'
import { repoOfImage } from '../../../../src/shared/build-web-repos'
import { useDistRules } from '../use-dist-rules'
import { ImagePager, ImageSearchRow, ImageTableState, imageRowStyles } from './image-view-parts'
import {
  IMAGE_PAGE_SIZE,
  toggled,
  useImageHistory,
  useImageSort,
  useImageTableFollows
} from './use-image-query'

const DISTS = ['rhel', 'redos'] as const
const PUSHED = ['yes', 'no'] as const
const STATUSES = ['success', 'failed', 'running'] as const
const ALL_VERSIONS = 'all'
const SORTS: { value: BuildWebImageSort; label: string }[] = [
  { value: 'tag', label: 'Tag' },
  { value: 'version', label: 'Version' },
  { value: 'dist', label: 'dist' },
  { value: 'branch', label: 'Branch' },
  { value: 'at', label: 'Built' },
  { value: 'status', label: 'Status' },
  { value: 'registry', label: 'Registry' }
]
const keyOf = (b: BuildWebImageBuild) => `${b.run_id}|${b.dist}|${b.number}`
const pushedLabel = (v: (typeof PUSHED)[number]) => (v === 'yes' ? 'in registry' : 'not pushed')

/** One image's builds, newest first by default, with the same picks and actions as the list. */
export function ImageHistoryView({
  image,
  active,
  reloadToken,
  onBuild,
  onOpenLog
}: {
  image: string
  active: boolean
  reloadToken: number
  onBuild: (choice: ImageBuildChoice) => void
  onOpenLog: OpenImageLog
}) {
  const { status } = useBuildWebScreen()
  const tracking = useImageTracking()
  const [q, setQ] = useState('')
  // Why only Chat Platform: a monorepo image's redos builds are twins of its rhel ones (IS-230).
  const withDist = useDistRules().choosesDist(repoOfImage(image))
  const [dists, setDists] = useState<(typeof DISTS)[number][]>([])
  const [pushed, setPushed] = useState<(typeof PUSHED)[number][]>([])
  const [statuses, setStatuses] = useState<(typeof STATUSES)[number][]>([])
  const [version, setVersion] = useState(ALL_VERSIONS)
  const [page, setPage] = useState(0)
  const picks = useImagePicks()
  const sorting = useImageSort(() => setPage(0))
  const { data, loading, error, reload } = useImageHistory(
    {
      sort: sorting.sort ?? undefined,
      dir: sorting.dir,
      image,
      q,
      dists,
      pushed,
      statuses,
      version: version === ALL_VERSIONS ? undefined : version,
      page,
      pageSize: IMAGE_PAGE_SIZE
    },
    reloadToken
  )
  const builds = data?.builds ?? []
  const canBuild = status.perms.includes('build')
  const product = data?.builds[0]?.product || image.split('/')[0] || ''
  useImageTableFollows(reload, {
    // Why: a build started elsewhere (build-web, a train) shows its outcome without a refresh.
    running: (data?.counts.statuses.running ?? 0) > 0,
    pushing: pushesGoing(tracking.pushes).ids.length > 0,
    pushSettles: tracking.pushSettles,
    active
  })

  const renderBuild = ({ item: b }: { item: BuildWebImageBuild }) => {
    const picked = picks.has(keyOf(b))
    return (
      <View style={[imageRowStyles.row, picked ? imageRowStyles.picked : null]}>
        <View style={imageRowStyles.tick}>
          {/* Why no disabled box: a faded one reads the same as an empty one. */}
          {imageRefOf(b) ? (
            <BuildTabTick
              checked={picked}
              onPress={() => picks.toggle(keyOf(b), b)}
              accessibilityLabel={`Pick ${b.tag ?? image}`}
            />
          ) : null}
        </View>
        <View style={imageRowStyles.body}>
          <View style={imageRowStyles.top}>
            <View style={styles.tag}>
              {b.tag ? <BuildWebToneChip label={b.tag} tone={null} mono /> : null}
            </View>
            <BuildStatusChip build={b} />
          </View>
          <View style={imageRowStyles.facts}>
            {b.product_version ? (
              <BuildWebToneChip label={b.product_version} tone={null} mono />
            ) : null}
            <Text style={imageRowStyles.meta}>{b.dist}</Text>
            <Text style={[imageRowStyles.meta, styles.branch]} numberOfLines={1}>
              {b.branch}
            </Text>
            {b.at ? <Text style={imageRowStyles.meta}>{formatBuildTime(b.at)}</Text> : null}
            <LogLink build={b} onOpen={onOpenLog} />
            <RegistryChip build={b} />
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.image} numberOfLines={2}>
          {image}
        </Text>
        {canBuild ? (
          <BuildTabButton
            icon={Hammer}
            label="Build…"
            onPress={() => onBuild({ images: [image], product })}
          />
        ) : null}
        {status.baseUrl ? (
          <BuildTabButton
            icon={ExternalLink}
            variant="ghost"
            accessibilityLabel="Open in build-web"
            onPress={() =>
              openExternalLink(`${status.baseUrl}/images?image=${encodeURIComponent(image)}`)
            }
          />
        ) : null}
      </View>
      <ImageSearchRow
        value={q}
        placeholder="Search by tag"
        onChange={(next) => {
          setQ(next)
          setPage(0)
        }}
        sorting={sorting}
        sorts={SORTS}
      />
      <View style={styles.filters}>
        <View style={styles.version}>
          <SelectField
            title="Product version"
            value={version}
            options={[ALL_VERSIONS, ...(data?.versions ?? [])]}
            labelOf={(v) => (v === ALL_VERSIONS ? 'All versions' : v)}
            onChange={(next) => {
              setVersion(next)
              setPage(0)
            }}
          />
        </View>
        {withDist ? (
          <ImageFilterChips
            options={DISTS}
            counts={data?.counts.dists ?? {}}
            selected={dists}
            label={(d) => d}
            onToggle={(d) => {
              setDists(toggled(dists, d))
              setPage(0)
            }}
          />
        ) : null}
        <ImageFilterChips
          options={PUSHED}
          counts={data?.counts.pushed ?? {}}
          selected={pushed}
          label={pushedLabel}
          onToggle={(v) => {
            setPushed(toggled(pushed, v))
            setPage(0)
          }}
        />
        <ImageFilterChips
          options={STATUSES}
          counts={data?.counts.statuses ?? {}}
          selected={statuses}
          label={buildStatusLabel}
          onToggle={(s) => {
            setStatuses(toggled(statuses, s))
            setPage(0)
          }}
        />
      </View>
      <ImageActionBar
        picks={picks}
        canBuild={false}
        onBuild={onBuild}
        onPushed={() => reload(true)}
      />
      <ImageRunCards
        image={image}
        active={active}
        onSettled={() => reload(true)}
        onOpenLog={onOpenLog}
      />
      <ImageTableState
        error={error}
        loading={loading}
        empty={builds.length === 0}
        emptyText="No builds of this image match."
        onRetry={() => reload(true)}
      />
      {builds.length ? (
        <FlatList
          style={styles.grow}
          data={builds}
          keyExtractor={keyOf}
          renderItem={renderBuild}
          keyboardShouldPersistTaps="handled"
        />
      ) : null}
      <ImagePager
        total={data?.total ?? 0}
        of={data?.of ?? 0}
        page={page}
        loading={loading}
        onPageChange={setPage}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  grow: { flex: 1, minHeight: 0 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm
  },
  image: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: typography.monoFamily,
    fontSize: typography.bodySize,
    fontWeight: '600'
  },
  filters: { gap: spacing.xs + 2, paddingVertical: spacing.sm },
  version: { paddingHorizontal: spacing.md },
  tag: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  branch: { flexShrink: 1, fontFamily: typography.monoFamily }
})
