// Which Material Icon Theme icon a file or folder gets, read from the theme's own manifest the
// way VS Code reads it.

type IconTable = Record<string, string>

/** The part of the theme's manifest (`dist/material-icons.json`) the Explorer reads. */
export type MaterialIconManifest = {
  file: string
  folder: string
  folderExpanded: string
  fileExtensions: IconTable
  fileNames: IconTable
  folderNames: IconTable
  folderNamesExpanded: IconTable
  iconDefinitions: Record<string, { iconPath: string }>
  /** Icons drawn for a light background, over the tables above. */
  light?: Partial<
    Record<'fileExtensions' | 'fileNames' | 'folderNames' | 'folderNamesExpanded', IconTable>
  >
}

export type MaterialIconKind = 'file' | 'folder' | 'folder-open'

/** A whole name first, then each extension from the longest: `foo.spec.ts` is `spec.ts`, then `ts`. */
export function materialIconName(
  manifest: MaterialIconManifest,
  name: string,
  kind: MaterialIconKind,
  light: boolean
): string {
  // Why exact first: a few of the theme's keys are cased; the rest match any case.
  const pick = (key: keyof NonNullable<MaterialIconManifest['light']>, value: string) => {
    const lightTable = light ? manifest.light?.[key] : undefined
    for (const table of lightTable ? [lightTable, manifest[key]] : [manifest[key]]) {
      const hit = table[value] ?? table[value.toLowerCase()]
      if (hit) {
        return hit
      }
    }
    return undefined
  }
  if (kind === 'folder') {
    return pick('folderNames', name) ?? manifest.folder
  }
  if (kind === 'folder-open') {
    return pick('folderNamesExpanded', name) ?? manifest.folderExpanded
  }
  const byName = pick('fileNames', name)
  if (byName) {
    return byName
  }
  for (let dot = name.indexOf('.'); dot !== -1; dot = name.indexOf('.', dot + 1)) {
    const byExtension = pick('fileExtensions', name.slice(dot + 1))
    if (byExtension) {
      return byExtension
    }
  }
  return manifest.file
}

/** The icon's SVG file name without `.svg`, from its definition. */
export function materialIconFile(manifest: MaterialIconManifest, iconName: string): string | null {
  const path = manifest.iconDefinitions[iconName]?.iconPath
  return path ? path.slice(path.lastIndexOf('/') + 1).replace(/\.svg$/, '') : null
}
