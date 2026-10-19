import { describe, expect, it } from 'vitest'
import {
  isInsidePythonStringOrComment,
  logicalLineIndexAt,
  scanPythonSource
} from './python-logical-lines'

function lineTexts(source: string): string[] {
  const scan = scanPythonSource(source)
  return scan.lines.map((line) => source.slice(line.start, line.end))
}

function inside(source: string, needle: string, occurrence = 0): boolean {
  let offset = -1
  for (let i = 0; i <= occurrence; i++) {
    offset = source.indexOf(needle, offset + 1)
  }
  expect(offset).toBeGreaterThanOrEqual(0)
  return isInsidePythonStringOrComment(scanPythonSource(source), offset)
}

describe('scanPythonSource', () => {
  it('keeps offsets and newlines while blanking strings and comments', () => {
    const source = "x = \"a#b\"  # note\ny = '''one\ntwo'''\n"
    const scan = scanPythonSource(source)
    expect(scan.code).toHaveLength(source.length)
    const blank = (text: string): string => ' '.repeat(text.length)
    expect(scan.code).toBe(
      `x = ${blank('"a#b"  # note')}\ny = ${blank("'''one")}\n${blank("two'''")}\n`
    )
    expect(lineTexts(source)).toEqual(['x = "a#b"', "y = '''one\ntwo'''"])
  })

  it.each([
    ['r', 'r"\\d+"'],
    ['b', "b'\\x00'"],
    ['u', 'u"text"'],
    ['f', 'f"{x}"'],
    ['rb', 'rb"raw"'],
    ['BR', 'BR"raw"'],
    ['Rf', 'Rf"{x}"'],
    ['fR', 'fR"{x}"']
  ])('treats the %s prefix as part of the string token', (_prefix, literal) => {
    const source = `value = ${literal}\nafter = 1\n`
    const scan = scanPythonSource(source)
    expect(scan.code.slice(8, 8 + literal.length).trim()).toBe(literal.includes('{x}') ? 'x' : '')
    expect(lineTexts(source)).toEqual([`value = ${literal}`, 'after = 1'])
  })

  it('handles triple quotes with every prefix, embedded quotes and escapes', () => {
    for (const prefix of ['', 'r', 'b', 'u', 'f', 'rb', 'br', 'fr', 'rf', 'RB', 'Fr']) {
      const source = `s = ${prefix}"""a "quoted" \\""" still # in
string"""\nt = 2\n`
      expect(lineTexts(source)).toEqual([source.slice(0, source.indexOf('\nt')), 't = 2'])
      expect(inside(source, 'still')).toBe(true)
      expect(inside(source, 't = 2')).toBe(false)
    }
  })

  it('ends single-quoted strings at escaped quotes only', () => {
    const source = "a = 'it\\'s # not a comment'\nb = \"x\\\\\"  # comment\n"
    expect(lineTexts(source)).toEqual(["a = 'it\\'s # not a comment'", 'b = "x\\\\"'])
    expect(inside(source, 'not a comment')).toBe(true)
    expect(inside(source, 'comment', 1)).toBe(true)
    expect(inside(source, 'b =')).toBe(false)
  })

  it('treats words that are not prefixes as identifiers', () => {
    const source = 'xr"a"\nrr = 1\n'
    const scan = scanPythonSource(source)
    expect(scan.code.slice(0, 2)).toBe('xr')
    expect(lineTexts(source)).toEqual(['xr"a"', 'rr = 1'])
  })

  it('recovers from an unterminated single-quoted string at the line end', () => {
    expect(lineTexts('a = "open\nb = 2\n')).toEqual(['a = "open', 'b = 2'])
  })

  it('joins bracket continuations, including comments and blank lines inside them', () => {
    const source = 'call(a,  # first\n\n     b)\nnext = 1\n'
    expect(lineTexts(source)).toEqual(['call(a,  # first\n\n     b)', 'next = 1'])
  })

  it('joins backslash continuations and blanks the backslash', () => {
    const source = 'total = 1 + \\\n    2\nnext = 1\n'
    const scan = scanPythonSource(source)
    expect(lineTexts(source)).toEqual(['total = 1 + \\\n    2', 'next = 1'])
    expect(scan.code[source.indexOf('\\')]).toBe(' ')
  })

  it('handles CRLF line endings', () => {
    const source = 'a = (1,\r\n  2)\r\nb = 3\r\n'
    const scan = scanPythonSource(source)
    expect(scan.lines.map((line) => [line.startLine, line.endLine])).toEqual([
      [0, 1],
      [2, 2]
    ])
  })

  it('measures indentation with tabs advancing to multiples of 8', () => {
    const source = 'def f():\n\tif x:\n\t    y = 1\n  \tz = 2\n'
    const scan = scanPythonSource(source)
    expect(scan.lines.map((line) => line.indent)).toEqual([0, 8, 12, 8])
  })

  it('skips blank and comment-only lines', () => {
    const source = '\n# header\n\nx = 1\n    # indented comment\ny = 2\n'
    const scan = scanPythonSource(source)
    expect(scan.lines.map((line) => [line.startLine, line.indent])).toEqual([
      [3, 0],
      [5, 0]
    ])
  })

  it('ends an unclosed bracket at a following def or class', () => {
    const source = 'value = call(\n\ndef after():\n    pass\nclass K:\n    pass\n'
    expect(lineTexts(source)).toEqual(['value = call(', 'def after():', 'pass', 'class K:', 'pass'])
  })

  it('keeps f-string replacement fields as code, with nested strings and format specs', () => {
    const source = 'msg = f"{user.name!r:>{width}} {d["key"]} {{literal}}"\n'
    const scan = scanPythonSource(source)
    expect(inside(source, 'user')).toBe(false)
    expect(inside(source, 'width')).toBe(false)
    expect(inside(source, 'd[')).toBe(false)
    expect(inside(source, 'key')).toBe(true)
    expect(inside(source, 'literal')).toBe(true)
    expect(inside(source, '>')).toBe(true)
    expect(scan.code).toContain('user.name')
    expect(scan.code).not.toContain('literal')
    expect(lineTexts(source)).toHaveLength(1)
  })

  it('scans multi-line fields of triple-quoted f-strings', () => {
    const source = 'x = f"""\n{\n  value\n}\n"""\ny = 1\n'
    expect(inside(source, 'value')).toBe(false)
    expect(lineTexts(source)).toEqual(['x = f"""\n{\n  value\n}\n"""', 'y = 1'])
  })

  it('maps offsets to logical lines', () => {
    const source = 'a = (1,\n  2)\nb = 3\n'
    const scan = scanPythonSource(source)
    expect(logicalLineIndexAt(scan, source.indexOf('2'))).toBe(0)
    expect(logicalLineIndexAt(scan, source.indexOf('b'))).toBe(1)
    expect(logicalLineIndexAt(scan, 0)).toBe(0)
  })
})
