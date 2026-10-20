import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: { getState: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { issueFileConsoleUrl, issueFileOpenKind } from './build-web-issue-file-open'

const file = (name: string, mime: string, size = 1000) => ({ name, mime, size })

describe('issueFileOpenKind', () => {
  it('opens Markdown and HTML in their own tabs, by name', () => {
    expect(issueFileOpenKind(file('notes.MD', 'text/plain'))).toBe('markdown')
    expect(issueFileOpenKind(file('report.html', 'application/octet-stream'))).toBe('html')
  })

  it('shows pictures, PDF and text in a tab; anything else in the browser', () => {
    expect(issueFileOpenKind(file('shot.png', 'image/png'))).toBe('tab')
    expect(issueFileOpenKind(file('spec.pdf', 'application/pdf'))).toBe('tab')
    expect(issueFileOpenKind(file('run.log', 'application/octet-stream'))).toBe('tab')
    expect(issueFileOpenKind(file('call.mp4', 'video/mp4'))).toBe('browser')
    expect(issueFileOpenKind(file('plan.docx', 'application/msword'))).toBe('browser')
  })

  it('sends a file too large for a tab to the browser', () => {
    expect(issueFileOpenKind(file('big.md', 'text/markdown', 4 * 1024 * 1024))).toBe('browser')
  })

  it('names the console address of a file', () => {
    expect(issueFileConsoleUrl('https://bw.test', 'i 1', 'a1b2')).toBe(
      'https://bw.test/api/tms/issues/i%201/files/a1b2'
    )
  })
})
