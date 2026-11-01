import type { BuildWebRecapReportPiece } from '../../../../../shared/build-web-recap-types'

/**
 * A report read piece by piece (a whole one outgrows one reply), then handed over whole; null
 * once `wanted` says it no longer is. The phone reads it this way too.
 */
export async function readRecapReport(
  read: (offset: number) => Promise<BuildWebRecapReportPiece>,
  wanted: () => boolean
): Promise<string | null> {
  let html = ''
  let offset = 0
  for (;;) {
    const piece = await read(offset)
    if (!wanted()) {
      return null
    }
    html += piece.text
    // Why the empty check: a piece that adds nothing would otherwise ask forever.
    if (piece.next >= piece.total || piece.text.length === 0) {
      return html
    }
    offset = piece.next
  }
}
