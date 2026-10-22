// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { docxLinkTarget, withoutExternalDocxResources } from './docx-rendered-content-guard'

const PIXEL = 'data:image/png;base64,iVBORw0KGgo='

function rendered(html: string): Element {
  const host = document.createElement('div')
  host.innerHTML = html
  const [first] = host.children
  if (!first) {
    throw new Error('no element')
  }
  return first
}

describe('withoutExternalDocxResources', () => {
  it('keeps pictures from the file and drops ones from an outside address', () => {
    const page = rendered(
      `<section><img src="${PIXEL}"><img src="https://evil.test/p.png"><img>` +
        `<svg><image href="${PIXEL}"></image><image href="http://evil.test/v.png"></image></svg></section>`
    )

    const [kept] = withoutExternalDocxResources([page])

    expect(kept).toBe(page)
    expect([...page.querySelectorAll('img')].map((img) => img.getAttribute('src'))).toEqual([PIXEL])
    expect(page.querySelectorAll('image')).toHaveLength(1)
  })

  it('drops frames, objects and scripts, nested or on their own', () => {
    const page = rendered(
      '<section><iframe srcdoc="x"></iframe><object data="x"></object><script></script>' +
        '<p>text</p></section>'
    )
    const frame = rendered('<iframe srcdoc="x"></iframe>')

    expect(withoutExternalDocxResources([page, frame])).toEqual([page])
    expect(page.innerHTML).toBe('<p>text</p>')
  })

  it('turns outside addresses in styles into none, keeping embedded fonts and images', () => {
    const style = rendered(
      `<style>@import "https://evil.test/a.css"; ` +
        `@font-face { src: url(${PIXEL}) } ` +
        `input[value^="a"] { background: url( 'https://evil.test/a' ) } ` +
        `.b { background: -webkit-image-set("https://evil.test/b" 1x) }</style>`
    )
    const run = rendered(`<span style="background-image: url(http://evil.test/c)">run</span>`)

    withoutExternalDocxResources([style, run])

    expect(style.textContent).toBe(
      `none "https://evil.test/a.css"; ` +
        `@font-face { src: url(${PIXEL}) } ` +
        `input[value^="a"] { background: none } ` +
        `.b { background: none"https://evil.test/b" 1x) }`
    )
    expect(run.getAttribute('style')).not.toContain('evil.test/c')
  })

  it('passes text nodes through', () => {
    const text = document.createTextNode('plain')
    expect(withoutExternalDocxResources([text])).toEqual([text])
  })
})

describe('docxLinkTarget', () => {
  it('follows bookmarks inside the document and web pages', () => {
    expect(docxLinkTarget('#_Toc123')).toEqual({ kind: 'bookmark', id: '_Toc123' })
    expect(docxLinkTarget('https://example.com/a b')).toEqual({
      kind: 'web',
      url: 'https://example.com/a%20b'
    })
  })

  it.each([null, '', '#', 'javascript:alert(1)', 'file:///etc/passwd', 'mailto:a@b.c', 'rel/x'])(
    'ignores %s',
    (href) => {
      expect(docxLinkTarget(href)).toBeNull()
    }
  )
})
