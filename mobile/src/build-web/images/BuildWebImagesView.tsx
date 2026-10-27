import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { BuildLogSheet } from '../issue/tabs/build/BuildLogSheet'
import { ImageBuildSheet, type ImageBuildChoice } from './ImageBuildSheet'
import { ImageHistoryView } from './ImageHistoryView'
import { ImageListView } from './ImageListView'

/** build-web's Images section: the newest build of every image, and one image's history. */
export function BuildWebImagesView({
  image,
  active,
  reloadToken,
  onOpenImage
}: {
  image: string | null
  active: boolean
  reloadToken: number
  onOpenImage: (image: string) => void
}) {
  const [building, setBuilding] = useState<ImageBuildChoice | null>(null)
  const [log, setLog] = useState<{ url: string; title: string } | null>(null)
  const openLog = (url: string, title: string) => setLog({ url, title })
  return (
    <View style={styles.fill}>
      {/* The list stays mounted under a history so its filters, picks and page survive Back. */}
      <View style={[styles.fill, image ? styles.hidden : null]}>
        <ImageListView
          active={active && !image}
          reloadToken={reloadToken}
          onOpenImage={onOpenImage}
          onBuild={setBuilding}
          onOpenLog={openLog}
        />
      </View>
      {image ? (
        <ImageHistoryView
          key={image}
          image={image}
          active={active}
          reloadToken={reloadToken}
          onBuild={setBuilding}
          onOpenLog={openLog}
        />
      ) : null}
      <ImageBuildSheet choice={building} onClose={() => setBuilding(null)} />
      <BuildLogSheet log={log} onClose={() => setLog(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
  hidden: { display: 'none' }
})
