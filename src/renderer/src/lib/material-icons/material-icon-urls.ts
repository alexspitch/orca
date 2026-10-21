// Why URLs, not inline SVG: 1,251 icons stay files the browser loads as rows show them.
const urls = import.meta.glob<string>(
  '../../../../../node_modules/material-icon-theme/icons/*.svg',
  {
    query: '?url',
    import: 'default',
    eager: true
  }
)

/** Each icon's URL by its file name without `.svg`. */
export const MATERIAL_ICON_URLS: ReadonlyMap<string, string> = new Map(
  Object.entries(urls).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url])
)
