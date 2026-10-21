// A report's task numbers made links and its task types made coloured chips, the way Orca's own
// task list shows them. The report is agent-written HTML in a frame that cannot navigate, so a
// number is a marked span whose click the frame posts to Orca, which opens the task.

/** Numbers build-web gives tasks: its own `IS-42` (a subtask `IS-42.1`) and Jira's `SDAP-4242`. */
const TASK_KEY = /\b(?:IS|SDAP)-\d+(?:\.\d+)?\b/g
const TASK_KEY_ONLY = /^(?:IS|SDAP)-\d+(?:\.\d+)?$/

export const isRecapTaskKey = (key: string): boolean => TASK_KEY_ONLY.test(key)

/** What the frame posts when a number is clicked. */
export const RECAP_TASK_MESSAGE = 'orca-recap-task'

/** The task types of build-web's cards, as the report names them in its type column. */
export const RECAP_TASK_TYPES = ['bug', 'improvement', 'chore'] as const
export type RecapTaskType = (typeof RECAP_TASK_TYPES)[number]

/** Colours for the frame, which cannot read Orca's: one CSS colour per type and for a link. */
export type RecapTaskTones = Record<RecapTaskType | 'link', string>

// Why skip these: a script or a mermaid diagram reads its text as code, and a link already goes somewhere.
const SKIP = 'script, style, textarea, a, pre.mermaid, [data-orca-task]'

function linkTextNode(doc: Document, node: Text): void {
  const text = node.data
  TASK_KEY.lastIndex = 0
  if (!TASK_KEY.test(text)) {
    return
  }
  TASK_KEY.lastIndex = 0
  const out = doc.createDocumentFragment()
  let at = 0
  for (const match of text.matchAll(TASK_KEY)) {
    out.append(text.slice(at, match.index))
    const link = doc.createElement('span')
    link.setAttribute('data-orca-task', match[0])
    link.setAttribute('role', 'link')
    link.setAttribute('tabindex', '0')
    link.textContent = match[0]
    out.append(link)
    at = match.index + match[0].length
  }
  out.append(text.slice(at))
  node.replaceWith(out)
}

function styleOf(tones: RecapTaskTones): string {
  const chips = RECAP_TASK_TYPES.map((type) => `.orca-type-${type}{--orca-tone:${tones[type]}}`)
  return [
    `[data-orca-task]{color:${tones.link};text-decoration:underline;text-underline-offset:2px;cursor:pointer}`,
    '[data-orca-task]:focus-visible{outline:2px solid currentColor;outline-offset:1px;border-radius:2px}',
    '.orca-type{display:inline-block;padding:0 8px;border-radius:999px;font-size:12px;line-height:18px;' +
      'color:var(--orca-tone);background:color-mix(in srgb,var(--orca-tone) 15%,transparent);' +
      'border:1px solid color-mix(in srgb,var(--orca-tone) 40%,transparent)}',
    ...chips
  ].join('\n')
}

// Runs in the frame: a click (or Enter) on a number tells Orca which task to open.
const SCRIPT = `(() => {
  const open = (event) => {
    const link = event.target.closest && event.target.closest('[data-orca-task]')
    if (!link) return
    event.preventDefault()
    parent.postMessage({ type: '${RECAP_TASK_MESSAGE}', key: link.getAttribute('data-orca-task') }, '*')
  }
  document.addEventListener('click', open)
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') open(event)
  })
})()`

/** The report with its numbers linked and its type cells coloured; the rest is left as it was. */
export function linkRecapTasks(html: string, tones: RecapTaskTones): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const cell of doc.body.querySelectorAll('td')) {
    const type = cell.textContent?.trim().toLowerCase()
    const known = RECAP_TASK_TYPES.find((t) => t === type)
    if (known && !cell.querySelector('*')) {
      const chip = doc.createElement('span')
      chip.className = `orca-type orca-type-${known}`
      chip.textContent = cell.textContent?.trim() ?? known
      cell.replaceChildren(chip)
    }
  }
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    // Why the global Text: a parsed document has no window of its own; its nodes are this realm's.
    if (node instanceof Text && !node.parentElement?.closest(SKIP)) {
      texts.push(node)
    }
  }
  for (const node of texts) {
    linkTextNode(doc, node)
  }
  const style = doc.createElement('style')
  style.textContent = styleOf(tones)
  doc.head.append(style)
  const script = doc.createElement('script')
  script.textContent = SCRIPT
  doc.body.append(script)
  return `<!doctype html>${doc.documentElement.outerHTML}`
}
