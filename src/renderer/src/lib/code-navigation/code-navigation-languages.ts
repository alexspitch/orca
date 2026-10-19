import type { CodeNavigationLanguageId } from './code-navigation-types'

const CODE_NAVIGATION_LANGUAGES: readonly CodeNavigationLanguageId[] = [
  'typescript',
  'javascript',
  'python'
]

export function isCodeNavigationLanguage(
  languageId: string | null | undefined
): languageId is CodeNavigationLanguageId {
  return CODE_NAVIGATION_LANGUAGES.some((id) => id === languageId)
}

/** TS and JS import each other, so a definition search covers both families. */
export function definitionSearchIncludeGlobs(languageId: CodeNavigationLanguageId): string {
  return languageId === 'python' ? '*.py,*.pyi' : '*.ts,*.tsx,*.mts,*.cts,*.js,*.jsx,*.mjs,*.cjs'
}

export const DEFINITION_SEARCH_EXCLUDE_GLOBS =
  '**/node_modules/**,**/.venv/**,**/venv/**,**/__pycache__/**,**/dist/**,**/out/**,**/build/**'

const PYTHON_BUILTIN_NAMES: ReadonlySet<string> = new Set(
  (
    'abs aiter all anext any ascii bin bool breakpoint bytearray bytes callable chr ' +
    'classmethod compile complex delattr dict dir divmod enumerate eval exec filter float ' +
    'format frozenset getattr globals hasattr hash help hex id input int isinstance ' +
    'issubclass iter len list locals map max memoryview min next object oct open ord pow ' +
    'print property range repr reversed round set setattr slice sorted staticmethod str sum ' +
    'super tuple type vars zip __import__ self cls None True False NotImplemented Ellipsis ' +
    'Exception BaseException ValueError TypeError KeyError IndexError AttributeError ' +
    'RuntimeError NotImplementedError StopIteration OSError FileNotFoundError ImportError ' +
    'AssertionError ZeroDivisionError PermissionError TimeoutError LookupError ' +
    'ArithmeticError KeyboardInterrupt SystemExit'
  ).split(' ')
)

const PYTHON_KEYWORDS: ReadonlySet<string> = new Set(
  (
    'and as assert async await break class continue def del elif else except finally for from ' +
    'global if import in is lambda nonlocal not or pass raise return try while with yield'
  ).split(' ')
)

const JS_KEYWORDS: ReadonlySet<string> = new Set(
  (
    'break case catch class const continue debugger default delete do else enum export ' +
    'extends false finally for function if import in instanceof new null return super switch ' +
    'this throw true try typeof var void while with let static yield await async of undefined ' +
    'interface type implements private protected public readonly abstract declare namespace ' +
    'keyof as satisfies string number boolean any unknown never object symbol bigint console ' +
    'window document globalThis Promise Array Object String Number Boolean Map Set Error JSON ' +
    'Math Date RegExp Symbol Record Partial Pick Omit Readonly ReturnType Parameters ' +
    'NonNullable Exclude Extract Awaited'
  ).split(' ')
)

/** Names a workspace search would only answer with noise (keywords, builtins, std globals). */
export function isUnsearchableIdentifier(
  languageId: CodeNavigationLanguageId,
  name: string
): boolean {
  if (languageId === 'python') {
    return PYTHON_KEYWORDS.has(name) || PYTHON_BUILTIN_NAMES.has(name)
  }
  return JS_KEYWORDS.has(name)
}
