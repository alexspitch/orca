import { describe, expect, it } from 'vitest'
import type { CodeRange } from './code-navigation-types'
import {
  findImportBindingAt,
  findModuleSpecifierAt,
  parseJsModuleSyntax,
  type JsModuleSyntax
} from './js-module-syntax'

function r(line: number, column: number, endColumn: number, endLine = line): CodeRange {
  return { startLineNumber: line, startColumn: column, endLineNumber: endLine, endColumn }
}

function imports(syntax: JsModuleSyntax): string[] {
  return syntax.imports.map((b) => `${b.localName}=${b.importedName}@${b.specifier}`)
}

function exportsOf(syntax: JsModuleSyntax): string[] {
  return syntax.exports.map((entry) => {
    if (entry.kind === 'star') {
      return `*@${entry.specifier}`
    }
    if (entry.kind === 'reexport') {
      return `${entry.exportedName}<-${entry.importedName}@${entry.specifier}`
    }
    return `${entry.exportedName}<-${entry.localName}`
  })
}

function declarations(syntax: JsModuleSyntax): string[] {
  return syntax.declarations.map((d) => `${d.kind}:${d.name}`)
}

function specifiers(syntax: JsModuleSyntax): string[] {
  return syntax.specifiers.map((s) => s.specifier)
}

describe('parseJsModuleSyntax imports', () => {
  it('reads every ESM import form', () => {
    const syntax = parseJsModuleSyntax(
      [
        "import d from 'a'",
        "import * as ns from 'b'",
        "import { x, y as z, type T, default as dd, 'q-r' as qr } from 'c'",
        "import d2, { w } from 'd'",
        "import type { U } from 'e'",
        "import 'side-effect'",
        "import d3, * as ns2 from 'f';",
        "import type from 'g'",
        "import type Def from 'h'"
      ].join('\n')
    )
    expect(imports(syntax)).toEqual([
      'd=default@a',
      'ns=*@b',
      'x=x@c',
      'z=y@c',
      'T=T@c',
      'dd=default@c',
      'qr=q-r@c',
      'd2=default@d',
      'w=w@d',
      'U=U@e',
      'd3=default@f',
      'ns2=*@f',
      'type=default@g',
      'Def=default@h'
    ])
    expect(specifiers(syntax)).toEqual(['a', 'b', 'c', 'd', 'e', 'side-effect', 'f', 'g', 'h'])
  })

  it('records exact local and statement ranges', () => {
    const syntax = parseJsModuleSyntax("const a = 1\nimport { foo as bar } from './x';\n")
    expect(syntax.imports[0]).toEqual({
      localName: 'bar',
      importedName: 'foo',
      specifier: './x',
      localRange: r(2, 17, 20),
      statementRange: r(2, 1, 34)
    })
    expect(syntax.specifiers[0].range).toEqual(r(2, 28, 33))
  })

  it('reads multi-line import clauses', () => {
    const syntax = parseJsModuleSyntax("import {\n  a,\n  b as c,\n} from '../m'\n")
    expect(imports(syntax)).toEqual(['a=a@../m', 'c=b@../m'])
    expect(syntax.imports[1].statementRange).toEqual(r(1, 1, 14, 4))
  })

  it('reads TS import-equals and CommonJS require bindings', () => {
    const syntax = parseJsModuleSyntax(
      [
        "import fs = require('fs')",
        "const path = require('path')",
        "const { a, b: c, ...rest } = require('./lib')",
        "let def = require('./d').default, other = require('./o')",
        "var member = require('./m').member;",
        'import Alias = Some.Namespace'
      ].join('\n')
    )
    expect(imports(syntax)).toEqual([
      'fs=*@fs',
      'path=*@path',
      'a=a@./lib',
      'c=b@./lib',
      'def=default@./d',
      'other=*@./o',
      'member=member@./m'
    ])
    expect(syntax.imports[3].statementRange).toEqual(r(3, 1, 46))
    expect(declarations(syntax)).toEqual([])
  })

  it('keeps a require with extra work as a declaration', () => {
    const syntax = parseJsModuleSyntax(
      "const x = require('./x')(config)\nconst y = wrap(require('./y'))"
    )
    expect(imports(syntax)).toEqual([])
    expect(declarations(syntax)).toEqual(['variable:x', 'variable:y'])
    expect(specifiers(syntax)).toEqual(['./x', './y'])
  })

  it('collects dynamic import() and require() specifiers anywhere', () => {
    const syntax = parseJsModuleSyntax(
      [
        'export function load() {',
        "  return import('./lazy').then(() => require('./cjs'))",
        '}',
        "const Page = lazy(() => import('./page', { with: {} }))",
        "obj.import('./not-a-module')",
        "type T = typeof import('./types')"
      ].join('\n')
    )
    expect(specifiers(syntax)).toEqual(['./lazy', './cjs', './page', './types'])
    expect(imports(syntax)).toEqual([])
  })

  it('ignores import text inside strings, templates, substitutions, regexes and comments', () => {
    const syntax = parseJsModuleSyntax(
      [
        'const s = "import a from \'x\'"',
        "const t = `import b from 'y' ${ \"import c from 'z'\" } ${ `import d from 'w'` }`",
        "const re = /import e from 'v'/",
        "// import f from 'u'",
        "/* import g from 't' */",
        "const call = `require('nope')`"
      ].join('\n')
    )
    expect(imports(syntax)).toEqual([])
    expect(specifiers(syntax)).toEqual([])
    expect(declarations(syntax)).toEqual([
      'variable:s',
      'variable:t',
      'variable:re',
      'variable:call'
    ])
  })

  it('ignores imports nested in blocks and member calls named import', () => {
    const syntax = parseJsModuleSyntax("if (x) {\n  const y = require('./y')\n}\nfoo.import\n")
    expect(imports(syntax)).toEqual([])
    expect(specifiers(syntax)).toEqual(['./y'])
  })
})

describe('parseJsModuleSyntax exports', () => {
  it('reads exported declarations of every kind', () => {
    const syntax = parseJsModuleSyntax(
      [
        'export const a = 1, b = { x: [1, 2] }, MAX_SIZE = 3',
        'export let { c, d: e } = obj, [f, g = 2] = arr',
        'export var h',
        'export function fn() {}',
        'export async function afn() {}',
        'export function* gen() {}',
        'export class C {}',
        'export abstract class AC {}',
        'export interface I {}',
        'export type T<X> = X',
        'export enum E { A }',
        'export const enum CE { B }',
        'export declare const dc: number',
        'export declare function df(): void',
        'export namespace N.Inner {}',
        'export module M {}'
      ].join('\n')
    )
    const names = 'a b MAX_SIZE c e f g h fn afn gen C AC I T E CE dc df N M'.split(' ')
    expect(exportsOf(syntax)).toEqual(names.map((n) => `${n}<-${n}`))
    expect(declarations(syntax)).toEqual([
      'variable:a',
      'variable:b',
      'constant:MAX_SIZE',
      'variable:c',
      'variable:e',
      'variable:f',
      'variable:g',
      'variable:h',
      'function:fn',
      'function:afn',
      'function:gen',
      'class:C',
      'class:AC',
      'interface:I',
      'type:T',
      'enum:E',
      'enum:CE',
      'variable:dc',
      'function:df',
      'namespace:N',
      'namespace:M'
    ])
    expect(syntax.exports[1]).toEqual({
      kind: 'local',
      exportedName: 'b',
      localName: 'b',
      nameRange: r(1, 21, 22)
    })
  })

  it('splits declarators only at top-level commas, generics included', () => {
    const syntax = parseJsModuleSyntax(
      [
        'export const m = new Map<string, number>(), n: Record<string, Array<number>> = {}, o = f(a, b)',
        'export const p = <T,>(x: T, y: T) => x,',
        '  q = 2',
        'export const r = 1',
        '  + 2',
        'export const s = (a < b), t = c > d'
      ].join('\n')
    )
    expect(exportsOf(syntax)).toEqual([
      'm<-m',
      'n<-n',
      'o<-o',
      'p<-p',
      'q<-q',
      'r<-r',
      's<-s',
      't<-t'
    ])
  })

  it('reads default exports', () => {
    const syntax = parseJsModuleSyntax(
      [
        'export default function named() {}',
        'export default class Klass extends Base {}',
        'export default async function asyncNamed() {}',
        'export default abstract class Abs {}',
        'export default function () {}',
        'export default class extends Base {}',
        'export default { a: 1 }',
        'export default ident',
        'export default ident.member',
        'export default connect(a)(B);'
      ].join('\n')
    )
    expect(exportsOf(syntax)).toEqual([
      'default<-named',
      'default<-Klass',
      'default<-asyncNamed',
      'default<-Abs',
      'default<-',
      'default<-',
      'default<-',
      'default<-ident',
      'default<-',
      'default<-'
    ])
    expect(declarations(syntax)).toEqual([
      'function:named',
      'class:Klass',
      'function:asyncNamed',
      'class:Abs'
    ])
    expect(syntax.exports[0].kind === 'local' && syntax.exports[0].nameRange).toEqual(r(1, 25, 30))
    expect(syntax.exports[4].kind === 'local' && syntax.exports[4].nameRange).toEqual(r(5, 8, 15))
  })

  it('reads export clauses, re-exports and star exports', () => {
    const syntax = parseJsModuleSyntax(
      [
        'export { a, b as c }',
        'export { d as default }',
        'export type { T }',
        "export { e } from './e'",
        "export { default } from './f'",
        "export { default as G, h as 'h-h' } from './g'",
        "export * from './all'",
        "export * as ns from './ns'",
        "export type * from './types'",
        'export = Thing'
      ].join('\n')
    )
    expect(exportsOf(syntax)).toEqual([
      'a<-a',
      'c<-b',
      'default<-d',
      'T<-T',
      'e<-e@./e',
      'default<-default@./f',
      'G<-default@./g',
      'h-h<-h@./g',
      '*@./all',
      'ns<-*@./ns',
      '*@./types',
      'default<-Thing'
    ])
    expect(syntax.exports[1]).toMatchObject({ nameRange: r(1, 18, 19) })
    expect(syntax.exports[9]).toMatchObject({ nameRange: r(8, 13, 15) })
    expect(specifiers(syntax)).toEqual(['./e', './f', './g', './all', './ns', './types'])
  })

  it('exports require bindings declared with export const', () => {
    const syntax = parseJsModuleSyntax("export const x = require('./x')")
    expect(imports(syntax)).toEqual(['x=*@./x'])
    expect(exportsOf(syntax)).toEqual(['x<-x'])
    expect(declarations(syntax)).toEqual([])
  })

  it('handles decorators before exported and plain classes', () => {
    const syntax = parseJsModuleSyntax(
      "@Component({ selector: 'x' })\nexport class A {}\n@dec class B {}\n@a.b() @c\nclass C {}"
    )
    expect(exportsOf(syntax)).toEqual(['A<-A'])
    expect(declarations(syntax)).toEqual(['class:A', 'class:B', 'class:C'])
  })
})

describe('parseJsModuleSyntax CommonJS exports', () => {
  it('reads module.exports object literals', () => {
    const syntax = parseJsModuleSyntax(
      [
        'module.exports = {',
        '  a,',
        '  b: c,',
        '  d() {},',
        '  async e() {},',
        "  'f': g.h,",
        '  ...spread,',
        '  [computed]: 1,',
        '  get i() { return 1 },',
        '  j: function () {}',
        '}'
      ].join('\n')
    )
    expect(exportsOf(syntax)).toEqual([
      'default<-',
      'a<-a',
      'b<-c',
      'd<-',
      'e<-',
      'f<-',
      'i<-',
      'j<-'
    ])
    expect(syntax.exports[0]).toMatchObject({ nameRange: r(1, 1, 15) })
    expect(syntax.exports[2]).toMatchObject({ nameRange: r(3, 3, 4) })
  })

  it('reads module.exports identifier, require and property assignments', () => {
    const syntax = parseJsModuleSyntax(
      [
        'module.exports = Thing',
        "module.exports = require('./inner')",
        'module.exports.x = function x() {}',
        'exports.y = y',
        'exports.Z = class {}',
        'exports.a = exports.b = void 0',
        'exports.c = exports.d = shared',
        'foo.exports.nope = 1'
      ].join('\n')
    )
    expect(exportsOf(syntax)).toEqual([
      'default<-Thing',
      'default<-',
      '*@./inner',
      'x<-',
      'y<-y',
      'Z<-',
      'c<-shared',
      'd<-shared'
    ])
    expect(declarations(syntax)).toEqual(['function:x', 'class:Z'])
  })
})

describe('parseJsModuleSyntax declarations', () => {
  it('reads top-level declarations and skips nested ones', () => {
    const syntax = parseJsModuleSyntax(
      [
        'function outer() {',
        '  function inner() {}',
        '  const local = 1',
        '}',
        'const arrow = () => {',
        '  class Hidden {}',
        '}',
        'declare module "ambient" {}',
        'declare global { interface Window {} }',
        'declare namespace NS {}',
        'type Union =',
        "  | 'a'",
        "  | 'b'",
        'interface Shape {}',
        'for (const item of items) {}',
        'let x',
        'const f = function named() {}',
        'type Alias<T> = Map<T, string>',
        'const after = 1'
      ].join('\n')
    )
    expect(declarations(syntax)).toEqual([
      'function:outer',
      'variable:arrow',
      'namespace:NS',
      'type:Union',
      'interface:Shape',
      'variable:x',
      'variable:f',
      'type:Alias',
      'variable:after'
    ])
  })

  it('recovers top-level declarations after a mis-lexed TSX apostrophe', () => {
    const syntax = parseJsModuleSyntax(
      [
        "import { a } from './a'",
        'export function View() {',
        "  return <b>{a && <i>Don't</i>}</b>",
        '}',
        '',
        'export const later = 1',
        'function helper() {}'
      ].join('\n')
    )
    expect(exportsOf(syntax)).toEqual(['View<-View', 'later<-later'])
    expect(declarations(syntax)).toEqual(['function:View', 'variable:later', 'function:helper'])
  })
})

describe('parseJsModuleSyntax recovery', () => {
  it('keeps parsing after an apostrophe swallows a closing paren', () => {
    const syntax = parseJsModuleSyntax(
      [
        'export const A = () => (',
        "  <p>(Don't)</p>",
        ')',
        'const B = 1',
        'export const C = 2'
      ].join('\n')
    )
    expect(exportsOf(syntax)).toEqual(['A<-A', 'C<-C'])
    expect(declarations(syntax)).toEqual(['variable:A', 'variable:B', 'variable:C'])
  })

  it('keeps parsing after an apostrophe swallows a closing brace in an initializer', () => {
    const syntax = parseJsModuleSyntax(
      [
        'export const config = {',
        "  render: () => <b>{a && <i>Don't</i>}</b>,",
        '}',
        'export const later = 1'
      ].join('\n')
    )
    expect(exportsOf(syntax)).toEqual(['config<-config', 'later<-later'])
  })

  it('reads a generic arrow return type without splitting declarators', () => {
    const syntax = parseJsModuleSyntax(
      [
        'const isRecord = (value: unknown): value is Record<string, unknown> =>',
        "  typeof value === 'object'",
        'const GROK = specFor("grok")!',
        'const table = {} as const satisfies Record<string, readonly string[]>',
        'type Fn = () => void',
        'const after = 1'
      ].join('\n')
    )
    expect(declarations(syntax)).toEqual([
      'variable:isRecord',
      'constant:GROK',
      'variable:table',
      'type:Fn',
      'variable:after'
    ])
  })
})

describe('findImportBindingAt / findModuleSpecifierAt', () => {
  const syntax = parseJsModuleSyntax(
    ["import { foo as bar, baz } from './x'", "const { a: b } = require('./y')"].join('\n')
  )

  it('finds a binding by its local or imported name token', () => {
    expect(findImportBindingAt(syntax, { lineNumber: 1, column: 17 })?.localName).toBe('bar')
    expect(findImportBindingAt(syntax, { lineNumber: 1, column: 10 })?.localName).toBe('bar')
    expect(findImportBindingAt(syntax, { lineNumber: 1, column: 22 })?.localName).toBe('baz')
    expect(findImportBindingAt(syntax, { lineNumber: 2, column: 9 })?.localName).toBe('b')
    expect(findImportBindingAt(syntax, { lineNumber: 2, column: 12 })?.localName).toBe('b')
  })

  it('prefers the token under the cursor over a touching one', () => {
    const tight = parseJsModuleSyntax("import {a,b} from 'x'")
    expect(findImportBindingAt(tight, { lineNumber: 1, column: 11 })?.localName).toBe('b')
    expect(findImportBindingAt(tight, { lineNumber: 1, column: 10 })?.localName).toBe('a')
  })

  it('returns null away from bindings', () => {
    expect(findImportBindingAt(syntax, { lineNumber: 1, column: 2 })).toBeNull()
    expect(findImportBindingAt(syntax, { lineNumber: 1, column: 33 })).toBeNull()
  })

  it('finds a specifier by any column of its string literal', () => {
    expect(findModuleSpecifierAt(syntax, { lineNumber: 1, column: 33 })?.specifier).toBe('./x')
    expect(findModuleSpecifierAt(syntax, { lineNumber: 1, column: 37 })?.specifier).toBe('./x')
    expect(findModuleSpecifierAt(syntax, { lineNumber: 2, column: 27 })?.specifier).toBe('./y')
    expect(findModuleSpecifierAt(syntax, { lineNumber: 1, column: 5 })).toBeNull()
  })
})
