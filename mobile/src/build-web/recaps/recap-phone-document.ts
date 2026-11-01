import { recapReportDocument } from '../../../../src/renderer/src/components/build-web/recaps/recap-report-document'
import { recapTaskKeys } from '../../../../src/renderer/src/components/build-web/recaps/recap-task-links'
import { MERMAID_DIAGRAM_CONFIG } from '../../components/pr-sidebar/mermaid-diagram-config'
import { loadPageMermaid } from '../../components/pr-sidebar/mermaid-page-engine'
import { colors } from '../../theme/mobile-theme'

// A report is written for a frame that runs its charts and diagrams; the phone's shell lets no
// frame run a script. Its mermaid is drawn here by the app's own engine, as the PR comments' is;
// a chart is nothing but its script, so it names where it can be seen instead.

export type PhoneRecap = {
  /** The document for a frame that runs nothing. */
  html: string
  /** The task numbers it names, for the phone to open; the frame cannot pass a tap on one. */
  taskKeys: string[]
}

const CHART_NOTE = 'A chart: open the report in the browser to see it.'

// Why the console's own variables: the report's palette follows its colour scheme; the diagram's
// box does not, since the app draws every diagram dark.
const STYLE = `
main { overflow-x: auto; }
.orca-mermaid { margin: 12px 0; padding: 8px; border-radius: 6px; overflow-x: auto;
  background: ${colors.bgRaised}; }
.orca-chart { margin: 12px 0; padding: 10px 12px; border: 1px dashed var(--line, #3d444d);
  border-radius: 6px; color: var(--muted, #9198a1); font-size: 12.5px; }
`

// Why a counter: mermaid draws in the page by id, and two reports may be drawn at once.
let drawn = 0

async function drawMermaid(doc: Document): Promise<void> {
  const blocks = [...doc.querySelectorAll('pre.mermaid')]
  if (blocks.length === 0) {
    return
  }
  const mermaid = await loadPageMermaid()
  mermaid.initialize(MERMAID_DIAGRAM_CONFIG)
  for (const block of blocks) {
    try {
      const { svg } = await mermaid.render(`orca-recap-mermaid-${++drawn}`, block.textContent ?? '')
      const box = doc.createElement('div')
      box.className = 'orca-mermaid'
      // Strict mode already sanitized it, and this document is inert: nothing in it runs.
      box.innerHTML = svg
      block.replaceWith(box)
    } catch {
      // The source stays, as a diagram mermaid cannot read shows on the desktop.
    }
  }
}

/** The report as the phone shows it: no scripts, its diagrams drawn, its charts named. */
export async function phoneRecapDocument(html: string): Promise<PhoneRecap> {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const script of doc.querySelectorAll('script')) {
    script.remove()
  }
  // Before the diagrams are drawn: an SVG's text carries its stylesheet too.
  const taskKeys = recapTaskKeys(doc.body.textContent ?? '')
  for (const canvas of doc.querySelectorAll('canvas')) {
    const note = doc.createElement('p')
    note.className = 'orca-chart'
    note.textContent = CHART_NOTE
    canvas.replaceWith(note)
  }
  await drawMermaid(doc)
  const style = doc.createElement('style')
  style.textContent = STYLE
  doc.head.append(style)
  return {
    html: recapReportDocument(`<!doctype html>${doc.documentElement.outerHTML}`),
    taskKeys
  }
}
