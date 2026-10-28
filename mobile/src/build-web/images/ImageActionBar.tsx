import { useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { CloudUpload, Hammer } from 'lucide-react-native'
import type { BuildWebDistChoice } from '../../../../src/shared/build-web-dist-links'
import type { BuildWebImageBuild } from '../../../../src/shared/build-web-image-types'
import {
  isPushable,
  offersBuildTagOnly,
  offersMainTag,
  pushRequests
} from '../../../../src/shared/build-web-image-push'
import { pushKeyOf } from '../../../../src/shared/build-web-image-tracking'
import { imageLinksByDist } from '../../../../src/renderer/src/components/build-web/images/image-links'
import type { useImagePicks } from './use-image-picks'
import { ActionSheetModal } from '../../components/ActionSheetModal'
import { useClipboardWriter } from '../../platform/clipboard'
import { spacing } from '../../theme/mobile-theme'
import { buildWebErrorMessage } from '../build-web-operations'
import { DistCopyButton } from '../DistCopyButton'
import { useBuildWebScreen } from '../build-web-screen-context'
import { BuildTabButton } from '../issue/tabs/build/BuildTabControls'
import type { ImageBuildChoice } from './ImageBuildSheet'
import { useImageTracking } from './image-tracking'

type Picks = ReturnType<typeof useImagePicks>

/** «Build N» takes one product's images: the versions offered are that product's. */
function groupChoice(builds: readonly BuildWebImageBuild[]): ImageBuildChoice | null {
  const images = [...new Set(builds.map((b) => b.image))]
  const products = [...new Set(builds.map((b) => b.product))]
  const branches = [...new Set(builds.map((b) => b.branch.replace(/^origin\//, '')))]
  const [product] = products
  if (images.length === 0 || products.length !== 1 || !product) {
    return null
  }
  return { images, product, ...(branches.length === 1 ? { branch: branches[0] } : {}) }
}

/** What the picked builds can be given: their links, a build together, a push to the registry. */
export function ImageActionBar({
  picks,
  canBuild,
  onBuild,
  onPushed
}: {
  picks: Picks
  canBuild: boolean
  onBuild: (choice: ImageBuildChoice) => void
  onPushed: () => void
}) {
  const { call, notify } = useBuildWebScreen()
  const { trackPush } = useImageTracking()
  const clipboard = useClipboardWriter()
  const [pushOpen, setPushOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const linksOf = (choice: BuildWebDistChoice) => imageLinksByDist(picks.builds, choice)
  const images = new Set(picks.builds.map((b) => b.image)).size
  const group = groupChoice(picks.builds)
  const pushable = picks.pushable

  const copy = async (links: string[], choice: BuildWebDistChoice): Promise<boolean> => {
    try {
      await clipboard.writeText(links.join('\n'))
    } catch (failure) {
      notify(buildWebErrorMessage(failure), 'error')
      return false
    }
    const unpushed = linksOf(choice).filter((l) => !l.pushed).length
    notify(
      unpushed > 0
        ? `Copied. ${unpushed} of the copied images are not in the registry yet.`
        : `Copied ${links.length} link(s).`,
      unpushed > 0 ? 'info' : 'success'
    )
    return true
  }

  /** The choice in the sheet is the confirmation; every run is asked, one refusal costs no other. */
  const push = async (moveMainTag: boolean): Promise<void> => {
    setBusy(true)
    const refused = new Map<string, string>()
    let started = 0
    for (const request of pushRequests(pushable, moveMainTag)) {
      const names = request.combos.map((c) => c.image).join(', ')
      try {
        const result = await call('pushImages', request)
        if (!result.ok) {
          refused.set(request.runId, `${names} — ${result.error}`)
          continue
        }
        started += request.combos.length
        trackPush({
          runId: request.runId,
          keys: request.combos.map(pushKeyOf),
          startedAt: Date.now()
        })
      } catch (failure) {
        refused.set(request.runId, `${names} — ${buildWebErrorMessage(failure)}`)
      }
    }
    setBusy(false)
    const startedText =
      started > 0 ? `Push of ${started} image(s) started — build-web publishes the tags.` : ''
    if (refused.size > 0) {
      notify(`${startedText} Not pushed: ${[...refused.values()].join('; ')}`.trim(), 'error')
    } else if (startedText) {
      notify(startedText, 'success')
    }
    // Why `!isPushable`: a pick the push could not take stays for its link.
    picks.keepOnly((b) => !isPushable(b) || refused.has(b.run_id))
    onPushed()
  }

  if (picks.builds.length === 0) {
    return null
  }
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.bar}
      >
        <DistCopyButton
          label={`Copy links (${linksOf('both').length})`}
          linksOf={(choice) => linksOf(choice).map((l) => l.ref)}
          onCopy={copy}
        />
        {canBuild ? (
          <BuildTabButton
            icon={Hammer}
            label={`Build ${images}`}
            disabled={!group}
            accessibilityLabel={
              group ? `Build ${images}` : 'Pick images of one product to build them together'
            }
            onPress={() => group && onBuild(group)}
          />
        ) : null}
        <BuildTabButton
          icon={CloudUpload}
          label={`Push to registry (${pushable.length})`}
          disabled={pushable.length === 0}
          loading={busy}
          onPress={() => setPushOpen(true)}
        />
        <BuildTabButton label="Clear" variant="ghost" onPress={picks.clear} />
      </ScrollView>
      <ActionSheetModal
        visible={pushOpen}
        title="What to publish"
        onClose={() => setPushOpen(false)}
        actions={[
          ...(offersBuildTagOnly(pushable)
            ? [{ label: 'Build tag only', icon: CloudUpload, onPress: () => void push(false) }]
            : []),
          ...(offersMainTag(pushable)
            ? [
                {
                  label: offersBuildTagOnly(pushable) ? 'Build tag and main tag' : 'Main tag',
                  icon: CloudUpload,
                  onPress: () => void push(true)
                }
              ]
            : [])
        ]}
      />
    </>
  )
}

const styles = StyleSheet.create({
  // Why: a horizontal ScrollView in a column grows to fill it on web.
  scroll: { flexGrow: 0 },
  bar: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }
})
