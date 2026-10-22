import type { IBufferLine, ILink, ILinkProvider } from '@xterm/xterm'
import { translate } from '@/i18n/i18n'
import { buildWrappedLogicalLine, rangeForParsedFileLink } from './wrapped-terminal-link-ranges'
import {
  isTerminalLinkActionActivation,
  isTerminalLinkDirectActivation
} from './terminal-link-activation'
import { isMacPlatform } from './terminal-link-open-hints'
import {
  requestTerminalLinkAction,
  type TerminalLinkActionContext
} from './terminal-link-action-request'

// Task numbers in terminal output (`IS-179.13`, `SDAP-412`) as links to the task's card.

export type ParsedTaskKeyLink = { key: string; startIndex: number; endIndex: number }

// Why a fixed list: a bare `[A-Z]+-\d+` also takes UTF-8, SHA-256 and ISO-8859.
const TASK_KEY_PREFIXES = ['IS', 'SDAP'] as const
// A subtask carries its number after a dot: `IS-179.13`; a sentence's own dot is left out.
const TASK_KEY = new RegExp(
  `(?<![A-Za-z0-9_-])(?:${TASK_KEY_PREFIXES.join('|')})-\\d+(?:\\.\\d+)?(?![A-Za-z0-9_-]|\\.\\d)`,
  'g'
)

export function extractTaskKeyLinks(lineText: string): ParsedTaskKeyLink[] {
  if (!TASK_KEY_PREFIXES.some((prefix) => lineText.includes(`${prefix}-`))) {
    return []
  }
  return [...lineText.matchAll(TASK_KEY)].map((match) => ({
    key: match[0],
    startIndex: match.index,
    endIndex: match.index + match[0].length
  }))
}

/** What the provider reads of the terminal; xterm's Terminal is one. */
type TaskKeyTerminal = {
  buffer: { active: { getLine(y: number): IBufferLine | undefined } }
  clearSelection(): void
}

type TaskKeyLinkProviderDeps = {
  getTerminal: () => TaskKeyTerminal | null
  linkTooltip: { textContent: string | null; style: { display: string } }
  getLinkActionContext?: () => TerminalLinkActionContext | null
  openTask: (key: string) => Promise<void>
  /** The task's title for the hover; null when it is not known. */
  describeTask: (key: string) => Promise<string | null>
}

function openHint(showActions: boolean): string {
  const click = isMacPlatform() ? '⌘+click' : 'Ctrl+click'
  return showActions
    ? translate(
        'terminal.taskKeyLink.hintWithActions',
        'Click for actions or {{click}} to open the task',
        { click }
      )
    : translate('terminal.taskKeyLink.hint', '{{click}} to open the task', { click })
}

export function createTaskKeyLinkProvider(deps: TaskKeyLinkProviderDeps): ILinkProvider {
  // Why: the title arrives after the pointer may have moved on to another link or off them all.
  let hovered: ILink | null = null
  return {
    provideLinks: (bufferLineNumber, callback) => {
      const terminal = deps.getTerminal()
      const logicalLine = terminal
        ? buildWrappedLogicalLine(terminal.buffer.active, bufferLineNumber)
        : null
      const parsed = logicalLine ? extractTaskKeyLinks(logicalLine.text) : []
      if (!terminal || !logicalLine || parsed.length === 0) {
        callback(undefined)
        return
      }
      const links = parsed.flatMap((link): ILink[] => {
        const range = rangeForParsedFileLink(logicalLine, link.startIndex, link.endIndex)
        if (!range) {
          return []
        }
        const open = () => deps.openTask(link.key)
        const self: ILink = {
          range,
          text: link.key,
          activate: (event) => {
            if (isTerminalLinkDirectActivation(event)) {
              event?.preventDefault()
              void open()
              terminal.clearSelection()
              return
            }
            if (
              isTerminalLinkActionActivation(event) &&
              requestTerminalLinkAction(event, deps.getLinkActionContext?.(), {
                destination: link.key,
                kind: 'task',
                primary: {
                  label: translate('terminal.taskKeyLink.open', 'Open task'),
                  run: open
                }
              })
            ) {
              terminal.clearSelection()
            }
          },
          hover: () => {
            hovered = self
            const showActions = deps.getLinkActionContext
              ? deps.getLinkActionContext() !== null
              : true
            const hint = openHint(showActions)
            deps.linkTooltip.textContent = `${link.key} (${hint})`
            deps.linkTooltip.style.display = ''
            void deps
              .describeTask(link.key)
              .catch(() => null)
              .then((title) => {
                if (title && hovered === self) {
                  deps.linkTooltip.textContent = `${link.key} · ${title} (${hint})`
                }
              })
          },
          leave: () => {
            if (hovered === self) {
              hovered = null
            }
            deps.linkTooltip.style.display = 'none'
          }
        }
        return [self]
      })
      callback(links.length > 0 ? links : undefined)
    }
  }
}
