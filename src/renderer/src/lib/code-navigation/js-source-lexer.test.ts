import { describe, expect, it } from 'vitest'
import { lexJsSource, type JsToken } from './js-source-lexer'

function summary(tokens: JsToken[]): string[] {
  return tokens.map((token) => `${token.kind}:${token.value}@${token.depth}`)
}

function find(tokens: JsToken[], value: string): JsToken {
  const token = tokens.find((candidate) => candidate.value === value)
  if (!token) {
    throw new Error(`no token ${value}`)
  }
  return token
}

describe('lexJsSource', () => {
  it('emits identifiers, strings and punctuation with offsets and brace depth', () => {
    const tokens = lexJsSource("const a = { b: 'x' }")
    expect(summary(tokens)).toEqual([
      'identifier:const@0',
      'identifier:a@0',
      'punctuation:=@0',
      'punctuation:{@0',
      'identifier:b@1',
      'punctuation::@1',
      'string:x@1',
      'punctuation:}@0'
    ])
    const str = tokens[6]
    expect([str.start, str.end]).toEqual([15, 18])
  })

  it('drops line and block comments and records the line breaks they hide', () => {
    const tokens = lexJsSource('a // import x from "y"\n/* import z\nfrom "q" */ b /* c */ d')
    expect(tokens.map((token) => token.value)).toEqual(['a', 'b', 'd'])
    expect(tokens.map((token) => token.newlineBefore)).toEqual([false, true, false])
  })

  it('decodes common string escapes', () => {
    const tokens = lexJsSource(String.raw`'a\'b' "c\"d\\e\n" 'f\
g'`)
    expect(tokens.map((token) => token.value)).toEqual(["a'b", 'c"d\\e\n', 'fg'])
  })

  it('stops an unterminated string at the line break', () => {
    const tokens = lexJsSource("<p>Don't {go}\nnext")
    expect(tokens.find((token) => token.kind === 'string')?.value).toBe('t {go}')
    expect(tokens.at(-1)).toMatchObject({ kind: 'identifier', value: 'next', depth: 0 })
  })

  it('treats template text as opaque and lexes substitutions one level deeper', () => {
    const tokens = lexJsSource('x = `import a from "b" ${ fn(`in ${deep} {`) } tail {` + y')
    expect(summary(tokens)).toEqual([
      'identifier:x@0',
      'punctuation:=@0',
      'template:`import a from "b" ${@0',
      'identifier:fn@1',
      'punctuation:(@1',
      'template:`in ${@1',
      'identifier:deep@2',
      'template:} {`@1',
      'punctuation:)@1',
      'template:} tail {`@0',
      'punctuation:+@0',
      'identifier:y@0'
    ])
  })

  it('keeps an object literal inside a substitution balanced', () => {
    const tokens = lexJsSource('`${ {a: 1}.a }` ; after')
    expect(find(tokens, 'after').depth).toBe(0)
    expect(find(tokens, 'a').depth).toBe(2)
  })

  it('tells a regex from division by the previous token', () => {
    expect(summary(lexJsSource('a / b / c'))).toEqual([
      'identifier:a@0',
      'punctuation:/@0',
      'identifier:b@0',
      'punctuation:/@0',
      'identifier:c@0'
    ])
    const regex = lexJsSource('x = /{[/]}"/g.test(s); y')
    expect(regex[2]).toMatchObject({ kind: 'regex', value: '/{[/]}"/g' })
    expect(find(regex, 'y').depth).toBe(0)
    expect(lexJsSource('return /a}/')[1].kind).toBe('regex')
    expect(lexJsSource('f(x) / 2 / 3').filter((token) => token.kind === 'regex')).toEqual([])
    expect(lexJsSource('n++ / 2 / 1').filter((token) => token.kind === 'regex')).toEqual([])
  })

  it('treats `/` without a closing slash on its line as division', () => {
    const tokens = lexJsSource('= / {\n}')
    expect(summary(tokens)).toEqual([
      'punctuation:=@0',
      'punctuation:/@0',
      'punctuation:{@0',
      'punctuation:}@0'
    ])
  })

  it('never reads a JSX closing tag as a regex', () => {
    const tokens = lexJsSource('<a>{x}</a> {y} </b>')
    expect(tokens.some((token) => token.kind === 'regex')).toBe(false)
    expect(find(tokens, 'y').depth).toBe(1)
  })

  it('lexes numbers, multi-character operators and private names', () => {
    const tokens = lexJsSource('a?.b ?? 1.5e-3 === 0x1F ... #p => c?.5:1')
    expect(tokens.map((token) => token.value)).toEqual([
      'a',
      '?.',
      'b',
      '??',
      '1.5e-3',
      '===',
      '0x1F',
      '...',
      '#',
      'p',
      '=>',
      'c',
      '?',
      '.5',
      ':',
      '1'
    ])
  })

  it('skips a hashbang line', () => {
    expect(lexJsSource('#!/usr/bin/env node\nfoo').map((token) => token.value)).toEqual(['foo'])
  })

  it('resyncs brace depth at a column-0 declaration after a mis-lexed TSX apostrophe', () => {
    const source = [
      'export function A() {',
      "  return <b>{cond && <i>Don't</i>}</b>",
      '}',
      '',
      'export const B = 1',
      'module.exports.c = 2',
      'exports.d = 3'
    ].join('\n')
    const tokens = lexJsSource(source)
    expect(find(tokens, 'B').depth).toBe(0)
    expect(find(tokens, 'c').depth).toBe(0)
    expect(find(tokens, 'd').depth).toBe(0)
  })

  it('does not resync while a template literal or block comment is open', () => {
    const inTemplate = lexJsSource('f(`${ {\nexport const fake = 1\n} }`)')
    expect(find(inTemplate, 'fake').depth).toBe(2)
    const inComment = lexJsSource('{ /*\nexport const fake = 1 */ inner }')
    expect(find(inComment, 'inner').depth).toBe(1)
  })

  it('does not resync on an indented or prefixed keyword or an object key', () => {
    const tokens = lexJsSource('{\n  const a = 1\nconstant\ntype: 1\n}')
    expect(find(tokens, 'a').depth).toBe(1)
    expect(find(tokens, 'constant').depth).toBe(1)
    expect(find(tokens, 'type')).toMatchObject({ depth: 1, lineResync: false })
  })

  it('flags the first token of a resynced line', () => {
    const tokens = lexJsSource('f(\nexport const a = 1')
    expect(tokens.map((token) => token.lineResync)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false
    ])
  })
})
