import { describe, expect, it, vi } from 'vitest'
import type {
  CodeDefinitionResult,
  CodeDefinitionSearchMatch,
  CodeNavigationDocument,
  CodeNavigationFileAccess
} from './code-navigation-types'
import { pythonCodeNavigationEngine } from './python-code-navigation-engine'
import { computeLineStarts, offsetToPosition } from './source-text-positions'

let uniqueId = 0

type FakeFiles = CodeNavigationFileAccess & {
  reads: string[]
  searchDefinitions: ReturnType<typeof vi.fn>
}

function fakeFiles(
  workspace: Record<string, string>,
  searchMatches: CodeDefinitionSearchMatch[] = []
): FakeFiles {
  const reads: string[] = []
  return {
    cacheScope: `fake-${uniqueId++}`,
    reads,
    readText: (relativePath) => {
      reads.push(relativePath)
      return Promise.resolve(workspace[relativePath] ?? null)
    },
    existing: (relativePaths) =>
      Promise.resolve(new Set(relativePaths.filter((path) => Object.hasOwn(workspace, path)))),
    searchDefinitions: vi.fn(() => Promise.resolve(searchMatches))
  }
}

function documentFor(
  relativePath: string | null,
  text: string,
  files: CodeNavigationFileAccess | null
): CodeNavigationDocument {
  return {
    modelUri: `file:///workspace/${relativePath ?? 'untitled'}#${uniqueId++}`,
    languageId: 'python',
    text,
    version: 1,
    relativePath,
    files
  }
}

/** `path:line:column` of the `^` in `pattern` within `text`. */
function locate(path: string, text: string, pattern: string): string {
  const offset = text.indexOf(pattern.replace('^', '')) + pattern.indexOf('^')
  const position = offsetToPosition(computeLineStarts(text), offset)
  return `${path}:${position.lineNumber}:${position.column}`
}

function describeResults(
  doc: CodeNavigationDocument,
  results: readonly CodeDefinitionResult[]
): string[] {
  return results.map((result) => {
    const path = result.target.kind === 'same' ? doc.relativePath : result.target.relativePath
    return `${path}:${result.range.startLineNumber}:${result.range.startColumn} ${result.source}`
  })
}

async function definitionsAt(
  doc: CodeNavigationDocument,
  pattern: string,
  signal = new AbortController().signal
): Promise<string[]> {
  const offset = doc.text.indexOf(pattern.replace('^', '')) + pattern.indexOf('^')
  expect(offset).toBeGreaterThanOrEqual(pattern.indexOf('^'))
  const position = offsetToPosition(computeLineStarts(doc.text), offset)
  const results = await pythonCodeNavigationEngine.getDefinitions(doc, position, signal)
  return describeResults(doc, results ?? [])
}

const MODELS = `class Manager:
    pass


class User:
    objects = Manager()

    def save(self):
        pass
`

describe('pythonCodeNavigationEngine basics', () => {
  it('identifies itself and supports only python', () => {
    expect(pythonCodeNavigationEngine.id).toBe('builtin-python')
    expect(pythonCodeNavigationEngine.supports('python')).toBe(true)
    expect(pythonCodeNavigationEngine.supports('typescript')).toBe(false)
  })

  it('returns an outline, never null', async () => {
    const signal = new AbortController().signal
    const doc = documentFor('m.py', 'def f():\n    pass\n', null)
    const outline = await pythonCodeNavigationEngine.getOutline(doc, signal)
    expect(outline?.map((symbol) => symbol.name)).toEqual(['f'])
    await expect(
      pythonCodeNavigationEngine.getOutline(documentFor('e.py', '', null), signal)
    ).resolves.toEqual([])
  })

  it('resolves in-file definitions as semantic results', async () => {
    const text = 'def helper():\n    pass\n\nhelper()\n'
    const doc = documentFor('m.py', text, fakeFiles({}))
    expect(await definitionsAt(doc, '^helper()\n')).toEqual([
      `${locate('m.py', text, 'def ^helper')} semantic`
    ])
  })

  it('answers nothing inside strings and comments, but resolves f-string fields', async () => {
    const text = 'name = 1\nprint("name")  # name\nprint(f"{name}")\n'
    const files = fakeFiles({})
    const doc = documentFor('m.py', text, files)
    expect(await definitionsAt(doc, '"^name"')).toEqual([])
    expect(await definitionsAt(doc, '# ^name')).toEqual([])
    expect(await definitionsAt(doc, '{^name}')).toEqual([
      `${locate('m.py', text, '^name =')} semantic`
    ])
    expect(await definitionsAt(doc, 'print(^f"')).toEqual([])
    expect(files.searchDefinitions).not.toHaveBeenCalled()
  })

  it('skips builtins and keywords without searching', async () => {
    const files = fakeFiles({})
    const doc = documentFor('m.py', 'print(len(x))\nif True: pass\n', files)
    expect(await definitionsAt(doc, '^print')).toEqual([])
    expect(await definitionsAt(doc, '^len')).toEqual([])
    expect(await definitionsAt(doc, '^True')).toEqual([])
    expect(files.searchDefinitions).not.toHaveBeenCalled()
  })

  it('falls back to a workspace search for unknown names', async () => {
    const files = fakeFiles({}, [
      {
        relativePath: 'lib/tools.py',
        line: 3,
        column: 1,
        matchLength: 13,
        lineContent: 'def mystery():'
      }
    ])
    const doc = documentFor('m.py', 'mystery()\n', files)
    expect(await definitionsAt(doc, '^mystery')).toEqual(['lib/tools.py:3:5 search'])
    expect(files.searchDefinitions).toHaveBeenCalledTimes(1)
  })
})

describe('pythonCodeNavigationEngine import hops', () => {
  it('follows a from-import to the definition in another file', async () => {
    const files = fakeFiles({ 'pkg/__init__.py': '', 'pkg/models.py': MODELS })
    const text = 'from pkg.models import User as U\nU()\n'
    const doc = documentFor('main.py', text, files)
    expect(await definitionsAt(doc, '^U()')).toEqual([
      `${locate('pkg/models.py', MODELS, 'class ^User')} import`
    ])
    expect(await definitionsAt(doc, 'import ^User')).toEqual([
      `${locate('pkg/models.py', MODELS, 'class ^User')} import`
    ])
  })

  it('resolves relative imports from nested packages', async () => {
    const files = fakeFiles({ 'pkg/models.py': MODELS, 'pkg/sub/view.py': '' })
    const doc = documentFor('pkg/sub/view.py', 'from ..models import Manager\nManager\n', files)
    expect(await definitionsAt(doc, '^Manager\n')).toEqual([
      `${locate('pkg/models.py', MODELS, 'class ^Manager')} import`
    ])
  })

  it('follows __init__.py re-export chains and star imports', async () => {
    const files = fakeFiles({
      'pkg/__init__.py': 'from .api import User\n',
      'pkg/api/__init__.py': 'from .impl import *\n',
      'pkg/api/impl.py': 'from ..models import User\n',
      'pkg/models.py': MODELS
    })
    const doc = documentFor('main.py', 'from pkg import User\nUser\n', files)
    expect(await definitionsAt(doc, '^User\n')).toEqual([
      `${locate('pkg/models.py', MODELS, 'class ^User')} import`
    ])
  })

  it('looks bare names up in the document’s own star imports', async () => {
    const files = fakeFiles({ 'pkg/models.py': MODELS })
    const doc = documentFor('main.py', 'from pkg.models import *\nUser()\n', files)
    expect(await definitionsAt(doc, '^User()')).toEqual([
      `${locate('pkg/models.py', MODELS, 'class ^User')} import`
    ])
  })

  it('returns a submodule file when the package does not define the name', async () => {
    const files = fakeFiles({
      'pkg/__init__.py': 'VERSION = 1\n',
      'pkg/tools.py': 'def run(): ...\n',
      'other/__init__.py': 'from . import tools\n',
      'other/tools.py': ''
    })
    const doc = documentFor(
      'main.py',
      'from pkg import tools\nfrom other import tools as t2\ntools\nt2\n',
      files
    )
    expect(await definitionsAt(doc, '^tools\n')).toEqual(['pkg/tools.py:1:1 import'])
    expect(await definitionsAt(doc, '^t2\n')).toEqual(['other/tools.py:1:1 import'])
  })

  it('stops on import cycles at the last re-export line it reached', async () => {
    const files = fakeFiles({
      'a.py': 'from b import Thing\n',
      'b.py': 'from a import Thing\n'
    })
    const text = 'from a import Thing\nThing\n'
    const doc = documentFor('main.py', text, files)
    expect(await definitionsAt(doc, '^Thing\n')).toEqual(['b.py:1:15 import'])
    expect(files.searchDefinitions).not.toHaveBeenCalled()
  })

  it('limits re-export depth', async () => {
    const workspace: Record<string, string> = { 'm6.py': 'class Deep: ...\n' }
    for (let i = 0; i < 6; i++) {
      workspace[`m${i}.py`] = `from m${i + 1} import Deep\n`
    }
    const shallow = documentFor('main.py', 'from m3 import Deep\nDeep\n', fakeFiles(workspace))
    expect(await definitionsAt(shallow, '^Deep\n')).toEqual(['m6.py:1:7 import'])
    const deep = documentFor('main.py', 'from m0 import Deep\nDeep\n', fakeFiles(workspace))
    expect(await definitionsAt(deep, '^Deep\n')).toEqual(['m3.py:1:16 import'])
  })

  it('searches, then falls back to the import binding, when the module is not in the workspace', async () => {
    const text = 'from external import thing\nimport numpy as np\nthing()\nnp\nnp.array\n'
    const empty = fakeFiles({})
    const doc = documentFor('main.py', text, empty)
    expect(await definitionsAt(doc, '^thing()')).toEqual([
      `${locate('main.py', text, 'import ^thing')} semantic`
    ])
    expect(await definitionsAt(doc, '^np\n')).toEqual([
      `${locate('main.py', text, 'as ^np')} semantic`
    ])
    expect(await definitionsAt(doc, 'np.^array')).toEqual([])
    const found = fakeFiles({}, [
      {
        relativePath: 'vendor/ext.py',
        line: 2,
        column: 1,
        matchLength: 10,
        lineContent: 'def thing('
      }
    ])
    expect(await definitionsAt(documentFor('main.py', text, found), '^thing()')).toEqual([
      'vendor/ext.py:2:5 search'
    ])
  })
})

describe('pythonCodeNavigationEngine module paths and attributes', () => {
  const workspace = {
    'pkg/__init__.py': '',
    'pkg/models.py': MODELS,
    'base.py': 'from root import Root\n\nclass Base(Root):\n    def save(self): ...\n',
    'root.py': 'from origin import Origin\n\nclass Root(Origin):\n    def load(self): ...\n',
    'origin.py': 'class Origin:\n    def far(self): ...\n'
  }

  it('opens the module file for a cursor on an import path segment', async () => {
    const text = 'from pkg.models import User\nimport pkg.models\nfrom missing import x\n'
    const doc = documentFor('main.py', text, fakeFiles(workspace))
    expect(await definitionsAt(doc, 'from ^pkg')).toEqual(['pkg/__init__.py:1:1 import'])
    expect(await definitionsAt(doc, 'from pkg.^models')).toEqual(['pkg/models.py:1:1 import'])
    expect(await definitionsAt(doc, 'import pkg.^models')).toEqual(['pkg/models.py:1:1 import'])
    expect(await definitionsAt(doc, 'from ^missing')).toEqual([])
  })

  it('hops through module aliases and dotted module chains', async () => {
    const text =
      'import pkg.models as m\nfrom pkg import models\nimport pkg.models\nm.User\nmodels.Manager\npkg.models.User.save\n'
    const doc = documentFor('main.py', text, fakeFiles(workspace))
    const user = `${locate('pkg/models.py', MODELS, 'class ^User')} import`
    expect(await definitionsAt(doc, 'm.^User')).toEqual([user])
    expect(await definitionsAt(doc, 'models.^Manager')).toEqual([
      `${locate('pkg/models.py', MODELS, 'class ^Manager')} import`
    ])
    expect(await definitionsAt(doc, 'User.^save')).toEqual([
      `${locate('pkg/models.py', MODELS, 'def ^save')} import`
    ])
  })

  it('resolves members of imported classes', async () => {
    const text = 'from pkg.models import User\nUser.objects\n'
    const doc = documentFor('main.py', text, fakeFiles(workspace))
    expect(await definitionsAt(doc, 'User.^objects')).toEqual([
      `${locate('pkg/models.py', MODELS, '^objects =')} import`
    ])
  })

  it('follows self and super() into imported base classes, two levels deep', async () => {
    const text = `from base import Base

class Child(Base):
    def run(self):
        self.save()
        super().load()
        self.far()
`
    const files = fakeFiles(workspace)
    const doc = documentFor('main.py', text, files)
    expect(await definitionsAt(doc, 'self.^save')).toEqual(['base.py:4:9 import'])
    expect(await definitionsAt(doc, 'super().^load')).toEqual(['root.py:4:9 import'])
    expect(await definitionsAt(doc, 'self.^far')).toEqual([])
    expect(files.reads).not.toContain('origin.py')
  })
})

describe('pythonCodeNavigationEngine without file access', () => {
  it('stays in the document', async () => {
    const text = 'from pkg.models import User\nimport pkg.models as m\nUser\nm.User\nunknown\n'
    const doc = documentFor('main.py', text, null)
    expect(await definitionsAt(doc, '^User\n')).toEqual([
      `${locate('main.py', text, 'import ^User')} semantic`
    ])
    expect(await definitionsAt(doc, 'pkg.^models import')).toEqual([])
    expect(await definitionsAt(doc, 'm.^User')).toEqual([])
    expect(await definitionsAt(doc, '^unknown')).toEqual([])
  })

  it('works for documents without a workspace path', async () => {
    const files = fakeFiles({ 'pkg/models.py': MODELS })
    const doc = documentFor(
      null,
      'from .models import User\nfrom pkg.models import Manager\nUser\nManager\n',
      files
    )
    expect(await definitionsAt(doc, '^Manager\n')).toEqual([
      `${locate('pkg/models.py', MODELS, 'class ^Manager')} import`
    ])
    expect(await definitionsAt(doc, '\n^User\nManager')).toEqual(['null:1:21 semantic'])
  })
})

describe('pythonCodeNavigationEngine cancellation', () => {
  it('rejects when the request is aborted mid-hop', async () => {
    const controller = new AbortController()
    const files = fakeFiles({ 'pkg/models.py': MODELS })
    const readText = files.readText.bind(files)
    files.readText = (path, signal) => {
      controller.abort()
      return readText(path, signal)
    }
    const doc = documentFor('main.py', 'from pkg.models import User\nUser\n', files)
    await expect(definitionsAt(doc, '^User\n', controller.signal)).rejects.toThrow()
  })
})
