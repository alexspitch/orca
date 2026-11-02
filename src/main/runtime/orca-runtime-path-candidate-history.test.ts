import { describe, expect, it, vi } from 'vitest'
import {
  appendRecentPtyPathCandidates,
  recentTerminalOutputIncludesPath,
  recentTerminalPathCandidatesIncludePath
} from './terminal-output-path-candidates'

function fullCandidateHistory(): string[] {
  return Array.from(
    { length: 1024 },
    (_, index) => `/tmp/artifact-${index.toString().padStart(4, '0')}.json`
  )
}

describe('PTY path candidate history', () => {
  it('reuses path-candidate history across repeated pathless PTY output', () => {
    const previous = fullCandidateHistory()
    const byteLengthSpy = vi.spyOn(Buffer, 'byteLength')
    let candidates = previous
    let replacements = 0
    let byteLengthCalls = 0
    try {
      for (let index = 0; index < 4096; index += 1) {
        const next = appendRecentPtyPathCandidates(
          candidates,
          'ordinary compiler progress without a path\n'
        )
        if (next !== candidates) {
          replacements += 1
        }
        candidates = next
      }
    } finally {
      byteLengthCalls = byteLengthSpy.mock.calls.length
      byteLengthSpy.mockRestore()
    }

    expect(candidates).toBe(previous)
    expect(replacements).toBe(0)
    expect(byteLengthCalls).toBe(0)
  })

  it('copies history when new output adds a path candidate', () => {
    const previous = fullCandidateHistory()
    const changed = appendRecentPtyPathCandidates(previous, 'wrote /tmp/new-artifact.json\n')

    expect(changed).not.toBe(previous)
    expect(changed).toContain('/tmp/new-artifact.json')
    expect(previous).not.toContain('/tmp/new-artifact.json')
  })

  it('finds a folder printed with a trailing slash by its resolved path', () => {
    const output = 'Screenshots: /tmp/claude-1001/scratchpad/ui/\r\n'
    const folder = '/tmp/claude-1001/scratchpad/ui'
    expect(recentTerminalOutputIncludesPath(output, folder, folder)).toBe(true)
    const history = appendRecentPtyPathCandidates(undefined, output)
    expect(recentTerminalPathCandidatesIncludePath(history, folder, folder)).toBe(true)
    expect(
      recentTerminalOutputIncludesPath(
        output,
        '/tmp/claude-1001/scratch',
        '/tmp/claude-1001/scratch'
      )
    ).toBe(false)
  })
})
