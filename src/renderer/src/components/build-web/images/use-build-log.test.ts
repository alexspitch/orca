import { describe, expect, it } from 'vitest'
import { cleanLogPiece } from './use-build-log'

describe('build log pieces', () => {
  it('drops colour codes, and carries one cut at the end into the next piece', () => {
    const first = cleanLogPiece('', 'ok \u001b[32mstep\u001b[', false)
    expect(first).toEqual({ text: 'ok step', carry: '\u001b[' })
    expect(cleanLogPiece(first.carry, '0m done\n', false)).toEqual({ text: ' done\n', carry: '' })
  })

  it('keeps nothing back once the log is over', () => {
    expect(cleanLogPiece('', 'end\u001b', true)).toEqual({ text: 'end\u001b', carry: '' })
  })
})
