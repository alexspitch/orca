// The report as build-web renders it, kept off the network: the console sends that as a header,
// which a srcdoc frame never sees, so it is written into the document instead.
export const RECAP_REPORT_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:"

const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${RECAP_REPORT_CSP}">`

/** The report with the policy first in its head, before any script it carries. */
export function recapReportDocument(html: string): string {
  const head = /<head(\s[^>]*)?>/i.exec(html)
  if (!head) {
    return `<!doctype html><head>${CSP_META}</head>${html}`
  }
  const at = head.index + head[0].length
  return `${html.slice(0, at)}${CSP_META}${html.slice(at)}`
}
