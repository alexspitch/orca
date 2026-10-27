import { useCallback, useEffect, useState } from 'react'
import { Image, Text, View } from 'react-native'
import { MobileMarkdown } from '../../../../components/MobileMarkdown'
import { colors, radii, spacing } from '../../../../theme/mobile-theme'
import { guideStyles } from './guide-tab-styles'
import { SHOT_URL_PREFIX } from './use-shot-urls'

/** One screenshot at the width of the text, at its own proportions once they are known. */
function GuideShotImage({ uri, alt }: { uri: string; alt: string }) {
  const [ratio, setRatio] = useState(16 / 9)
  useEffect(() => {
    let alive = true
    Image.getSize(
      uri,
      (width, height) => alive && width > 0 && height > 0 && setRatio(width / height),
      () => {}
    )
    return () => {
      alive = false
    }
  }, [uri])
  return (
    <View style={{ marginVertical: spacing.sm, gap: spacing.xs }}>
      <Image
        source={{ uri }}
        accessibilityLabel={alt}
        resizeMode="contain"
        style={{
          width: '100%',
          aspectRatio: ratio,
          borderRadius: radii.row,
          backgroundColor: colors.bgRaised
        }}
      />
      {alt ? <Text style={guideStyles.small}>{alt}</Text> : null}
    </View>
  )
}

/** The guide as the comment will read, its `shot:` frames drawn from the console's screenshots. */
export function GuidePreview({
  markdown,
  sources,
  growing
}: {
  markdown: string
  sources: ReadonlyMap<string, string>
  growing: boolean
}) {
  const renderImage = useCallback(
    (href: string, alt: string) => {
      const uri = href.startsWith(SHOT_URL_PREFIX) ? sources.get(href) : href
      return uri ? (
        <GuideShotImage uri={uri} alt={alt} />
      ) : (
        <Text style={guideStyles.meta}>{alt}</Text>
      )
    },
    [sources]
  )
  return <MobileMarkdown content={markdown} renderImage={renderImage} growing={growing} />
}
