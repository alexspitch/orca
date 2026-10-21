// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { isRecapTaskKey, linkRecapTasks } from './recap-task-links'

const TONES = { bug: 'red', improvement: 'teal', chore: 'gray', link: 'blue' }

function parse(html: string): Document {
  return new DOMParser().parseFromString(linkRecapTasks(html, TONES), 'text/html')
}

describe('linkRecapTasks', () => {
  it('links task numbers in text and table cells, a subtask and a Jira number too', () => {
    const doc = parse(
      '<html><head><title>r</title></head><body><p>Fixed IS-171 and SDAP-4003; see IS-42.1.</p>' +
        '<table><tr><td>IS-9</td><td>bug</td></tr></table></body></html>'
    )
    const keys = [...doc.querySelectorAll('[data-orca-task]')].map((e) =>
      e.getAttribute('data-orca-task')
    )
    expect(keys).toEqual(['IS-171', 'SDAP-4003', 'IS-42.1', 'IS-9'])
    expect(doc.querySelector('p')?.textContent).toBe('Fixed IS-171 and SDAP-4003; see IS-42.1.')
  })

  it('leaves what only looks like a number: code a script reads, a diagram, an encoding', () => {
    const doc = parse(
      '<body><p>UTF-8 and ISO-8601</p><pre class="mermaid">graph TD; IS-1 --- IS-2</pre>' +
        '<script>const k = "IS-5"</script><a href="#">IS-6</a></body>'
    )
    expect(doc.querySelectorAll('[data-orca-task]')).toHaveLength(0)
    // Why no `-->` here: happy-dom's parser doubles text before it; Chromium does not.
    expect(doc.querySelector('pre.mermaid')?.textContent).toBe('graph TD; IS-1 --- IS-2')
  })

  it('colours a cell that holds only a task type, and no other mention of the word', () => {
    const doc = parse(
      '<body><table><tr><td> improvement </td><td>Chore</td><td>a bug fix</td></tr></table></body>'
    )
    const chips = [...doc.querySelectorAll('.orca-type')].map((e) => e.className)
    expect(chips).toEqual(['orca-type orca-type-improvement', 'orca-type orca-type-chore'])
    expect(doc.querySelectorAll('td')[2].textContent).toBe('a bug fix')
    expect(doc.head.querySelector('style')?.textContent).toContain(
      '.orca-type-bug{--orca-tone:red}'
    )
  })

  it('accepts only build-web numbers from the frame', () => {
    expect(isRecapTaskKey('IS-42.1')).toBe(true)
    expect(isRecapTaskKey('SDAP-4003')).toBe(true)
    expect(isRecapTaskKey('IS-42; drop')).toBe(false)
    expect(isRecapTaskKey('UTF-8')).toBe(false)
  })
})
