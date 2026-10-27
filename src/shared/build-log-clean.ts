// A Jenkins console log as text: colour codes and Jenkins' hidden console notes dropped, read in
// pieces where a code or a note may be cut at a piece's end.

// oxlint-disable-next-line no-control-regex -- the escape character is exactly what is matched.
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g
// Why: Jenkins hides a serialized note (`ha:////<base64>`) between conceal and reset codes.
// oxlint-disable-next-line no-control-regex -- the escape character is exactly what is matched.
const CONSOLE_NOTE = /\u001b\[8mha:[A-Za-z0-9+/=]*\u001b\[0m/g
// A note or an escape begun at the very end, its rest still to come.
const OPEN_TAIL =
  // oxlint-disable-next-line no-control-regex -- the escape character is exactly what is matched.
  /\u001b\[8m(?:h|ha|ha:[A-Za-z0-9+/=]*(?:\u001b(?:\[0?)?)?)?$|\u001b(?:\[[0-9;?]*[ -/]*)?$/

/** A piece as text; a code or a note cut at its end is carried into the next piece. */
export function cleanLogPiece(
  carry: string,
  text: string,
  done: boolean
): { text: string; carry: string } {
  const raw = carry + text
  const cut = done ? null : OPEN_TAIL.exec(raw)
  const kept = cut ? raw.slice(0, cut.index) : raw
  return {
    text: kept.replace(CONSOLE_NOTE, '').replace(ANSI, ''),
    carry: cut ? cut[0] : ''
  }
}
