import { describe, expect, it } from 'vitest'
import { cleanLogPiece } from './build-log-clean'

describe('build log pieces', () => {
  it('drops colour codes, and carries one cut at the end into the next piece', () => {
    const first = cleanLogPiece('', 'ok \u001b[32mstep\u001b[', false)
    expect(first).toEqual({ text: 'ok step', carry: '\u001b[' })
    expect(cleanLogPiece(first.carry, '0m done\n', false)).toEqual({ text: ' done\n', carry: '' })
  })

  it('keeps nothing back once the log is over', () => {
    expect(cleanLogPiece('', 'end\u001b', true)).toEqual({ text: 'end\u001b', carry: '' })
  })

  it("drops Jenkins' hidden console notes, also one cut across pieces", () => {
    const note = '\u001b[8mha:////4L4BvPM9tyxuH2Ednl0pjq63M7t8Vr40ev==\u001b[0m'
    expect(cleanLogPiece('', `${note}[Pipeline] echo\n`, false)).toEqual({
      text: '[Pipeline] echo\n',
      carry: ''
    })
    const first = cleanLogPiece('', `step\n${note.slice(0, 20)}`, false)
    expect(first).toEqual({ text: 'step\n', carry: note.slice(0, 20) })
    expect(cleanLogPiece(first.carry, `${note.slice(20)}[Pipeline] }\n`, false)).toEqual({
      text: '[Pipeline] }\n',
      carry: ''
    })
  })
})
