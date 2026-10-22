// Why: the main renderer's CSP allows `img-src http:`, so anything in a document that names an
// outside address would be fetched — a beacon, or a CSS attribute-selector leak of the app's DOM.
const NEVER_RENDERED = 'iframe, frame, object, embed, script, link, meta, base'
const EMBEDDED_SOURCE = /^data:/i
const EXTERNAL_CSS_REFERENCE = /url\(\s*(?!["']?\s*data:)[^)]*\)|(?:-webkit-)?image-set\(|@import/gi
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink'

/** Rendered .docx nodes with nothing left that loads from outside the file itself. */
export function withoutExternalDocxResources(nodes: readonly Node[]): Node[] {
  return nodes.filter((node) => {
    if (!(node instanceof Element)) {
      return true
    }
    if (node.matches(NEVER_RENDERED) || !hasEmbeddedSource(node)) {
      return false
    }
    for (const element of node.querySelectorAll(NEVER_RENDERED)) {
      element.remove()
    }
    for (const element of node.querySelectorAll('img, image')) {
      if (!hasEmbeddedSource(element)) {
        element.remove()
      }
    }
    for (const element of [node, ...node.querySelectorAll('style, [style]')]) {
      neutralizeExternalCss(element)
    }
    return true
  })
}

function hasEmbeddedSource(element: Element): boolean {
  if (element.localName === 'img') {
    return EMBEDDED_SOURCE.test(element.getAttribute('src') ?? '')
  }
  if (element.localName === 'image') {
    const href = element.getAttribute('href') ?? element.getAttributeNS(XLINK_NAMESPACE, 'href')
    return EMBEDDED_SOURCE.test(href ?? '')
  }
  return true
}

function neutralizeExternalCss(element: Element): void {
  if (element.localName === 'style' && element.textContent) {
    element.textContent = element.textContent.replace(EXTERNAL_CSS_REFERENCE, 'none')
  }
  const inline = element.getAttribute('style')
  if (inline) {
    element.setAttribute('style', inline.replace(EXTERNAL_CSS_REFERENCE, 'none'))
  }
}

export type DocxLinkTarget = { kind: 'bookmark'; id: string } | { kind: 'web'; url: string }

/** Where a link in a rendered .docx may lead: a bookmark in it, or a web page; nothing else. */
export function docxLinkTarget(href: string | null): DocxLinkTarget | null {
  if (!href) {
    return null
  }
  if (href.startsWith('#')) {
    return href.length > 1 ? { kind: 'bookmark', id: href.slice(1) } : null
  }
  try {
    const url = new URL(href)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? { kind: 'web', url: url.href }
      : null
  } catch {
    return null
  }
}
