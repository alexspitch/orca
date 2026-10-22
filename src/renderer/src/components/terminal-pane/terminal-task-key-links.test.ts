// @vitest-environment happy-dom
import type { ILink } from '@xterm/xterm'
import { describe, expect, it, vi } from 'vitest'
import { createTaskKeyLinkProvider, extractTaskKeyLinks } from './terminal-task-key-links'

const keys = (line: string) => extractTaskKeyLinks(line).map((link) => link.key)

describe('task numbers in terminal output', () => {
  it('finds a task and a subtask, leaving a sentence’s own dot out', () => {
    const line = 'Коммичу IS-179.13, прикладываю план и закрываю подзадачу IS-179.'
    expect(extractTaskKeyLinks(line)).toEqual([
      { key: 'IS-179.13', startIndex: 8, endIndex: 17 },
      { key: 'IS-179', startIndex: 57, endIndex: 63 }
    ])
  })

  it('finds a Jira number among the known prefixes', () => {
    expect(keys('fixes SDAP-412 (see IS-7)')).toEqual(['SDAP-412', 'IS-7'])
  })

  it('leaves out lookalikes and numbers glued to other words', () => {
    expect(keys('UTF-8 SHA-256 ISO-8859-1 THIS-12 IS-12a x_IS-3 IS-3-4 IS-')).toEqual([])
  })
})

function bufferLine(text: string) {
  return {
    isWrapped: false,
    length: text.length,
    getCell: () => undefined,
    translateToString: (
      _trimRight?: boolean,
      start = 0,
      end = text.length,
      outColumns?: number[]
    ) => {
      if (outColumns) {
        outColumns.length = 0
        for (let index = start; index <= end; index++) {
          outColumns.push(index)
        }
      }
      return text.slice(start, end)
    }
  }
}

async function hoverable(text: string, describeTask: (key: string) => Promise<string | null>) {
  const rows = [bufferLine(text)]
  const tooltip = document.createElement('div')
  const provider = createTaskKeyLinkProvider({
    getTerminal: () => ({
      buffer: { active: { getLine: (y: number) => rows[y] } },
      clearSelection: vi.fn()
    }),
    linkTooltip: tooltip,
    getLinkActionContext: () => null,
    openTask: vi.fn(async () => {}),
    describeTask
  })
  const links = await new Promise<ILink[]>((resolve) =>
    provider.provideLinks(1, (found) => resolve(found ?? []))
  )
  return { links, tooltip }
}

const hover = (link: ILink | undefined) => link?.hover?.(new MouseEvent('mousemove'), link.text)
const leave = (link: ILink | undefined) => link?.leave?.(new MouseEvent('mouseleave'), link.text)

describe('the hover over a task number', () => {
  it('names the task once its title is read', async () => {
    const { links, tooltip } = await hoverable('see IS-179.13', async () => 'Версии модулей')
    hover(links[0])
    expect(tooltip.textContent).toMatch(/^IS-179\.13 \(/)
    await vi.waitFor(() => expect(tooltip.textContent).toMatch(/^IS-179\.13 · Версии модулей \(/))
  })

  it('leaves the tooltip alone when the pointer moved on before the title came', async () => {
    let answer: (title: string) => void = () => {}
    const { links, tooltip } = await hoverable('IS-1 and IS-2', (key) =>
      key === 'IS-1' ? new Promise((resolve) => (answer = resolve)) : Promise.resolve(null)
    )
    hover(links[0])
    leave(links[0])
    hover(links[1])
    answer('first')
    await Promise.resolve()
    await Promise.resolve()
    expect(tooltip.textContent).toMatch(/^IS-2 \(/)
  })
})
