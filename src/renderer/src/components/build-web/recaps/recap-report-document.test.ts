import { describe, expect, it } from 'vitest'
import { RECAP_REPORT_CSP, recapReportDocument } from './recap-report-document'

describe('a report document', () => {
  it('takes the policy first in its head, ahead of the libraries', () => {
    const html =
      '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<script>chart()</script>\n</head>\n' +
      '<body><header class="bw-meta"><h1>R</h1></header></body></html>'
    const out = recapReportDocument(html)
    const meta = out.indexOf(RECAP_REPORT_CSP)
    expect(meta).toBeGreaterThan(out.indexOf('<head>'))
    expect(meta).toBeLessThan(out.indexOf('<script>'))
    expect(out.split('Content-Security-Policy')).toHaveLength(2)
    expect(out.replace(/<meta http-equiv[^>]*>/, '')).toBe(html)
  })

  it('does not take a <header> for the head', () => {
    const out = recapReportDocument('<header>x</header><HEAD lang="ru"></HEAD>')
    expect(out.indexOf(RECAP_REPORT_CSP)).toBeGreaterThan(out.indexOf('<HEAD lang="ru">'))
  })

  it('gives a fragment without a head one of its own', () => {
    const out = recapReportDocument('<p>only a fragment</p>')
    expect(out.startsWith('<!doctype html><head><meta http-equiv="Content-Security-Policy"')).toBe(
      true
    )
    expect(out.endsWith('<p>only a fragment</p>')).toBe(true)
  })
})
