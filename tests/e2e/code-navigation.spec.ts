/**
 * E2E: code navigation in the source editor — go to definition across files (TypeScript and
 * Python), Back/Forward between locations, and the Outline panel.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

const FIXTURE_DIR = 'codenav-e2e'
const FIXTURE_FILES: Record<string, string> = {
  'app.ts': "import { greet } from './lib'\n\nexport function main() {\n  return greet('x')\n}\n",
  'lib/index.ts': "export { greet } from './greet'\n",
  'lib/greet.ts': '// greeting\n\nexport function greet(name: string) {\n  return name\n}\n',
  'pkg/__init__.py': '',
  'pkg/models.py': "class User:\n    def __init__(self):\n        self.name = 'x'\n",
  'pkg/service.py': 'from .models import User\n\n\ndef make():\n    return User()\n'
}

async function worktreePath(page: Page): Promise<string> {
  return page.evaluate(() => {
    const state = window.__store!.getState()
    const worktree = Object.values(state.worktreesByRepo)
      .flat()
      .find((entry) => entry.id === state.activeWorktreeId)
    return worktree!.path
  })
}

async function openFixtureFile(page: Page, relativeFile: string, language: string): Promise<void> {
  await page.evaluate(
    ({ relativePath, language }) => {
      const state = window.__store!.getState()
      const worktree = Object.values(state.worktreesByRepo)
        .flat()
        .find((entry) => entry.id === state.activeWorktreeId)!
      const separator = worktree.path.includes('\\') ? '\\' : '/'
      state.openFile({
        filePath: `${worktree.path}${separator}${relativePath.split('/').join(separator)}`,
        relativePath,
        worktreeId: state.activeWorktreeId!,
        language,
        mode: 'edit'
      })
    },
    { relativePath: `${FIXTURE_DIR}/${relativeFile}`, language }
  )
}

function activeEditor(page: Page) {
  return page
    .locator('.monaco-editor')
    .filter({ has: page.locator('.view-lines') })
    .first()
}

async function expectActiveLocation(page: Page, fileName: string, line: number): Promise<void> {
  await expect(page.locator('.editor-header-path').first()).toContainText(fileName, {
    timeout: 20_000
  })
  await expect(activeEditor(page).locator('.line-numbers.active-line-number')).toHaveText(
    String(line),
    { timeout: 10_000 }
  )
}

async function definitionClick(page: Page, lineText: string, token: string): Promise<void> {
  const line = activeEditor(page).locator('.view-line').filter({ hasText: lineText })
  await expect(line).toBeVisible({ timeout: 20_000 })
  // Monaco merges same-colored tokens into one span, so aim at the token's characters directly.
  const point = await line.evaluate((element, needle) => {
    const text = element.textContent ?? ''
    const index = text.indexOf(needle)
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let seen = 0
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const length = node.textContent?.length ?? 0
      if (index < seen + length) {
        const range = document.createRange()
        range.setStart(node, index - seen)
        range.setEnd(node, Math.min(index - seen + needle.length, length))
        const rect = range.getBoundingClientRect()
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      }
      seen += length
    }
    return null
  }, token)
  expect(point).not.toBeNull()
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
  await page.mouse.move(point!.x, point!.y)
  await page.keyboard.down(modifier)
  await page.mouse.down()
  await page.mouse.up()
  await page.keyboard.up(modifier)
}

const backChord = process.platform === 'darwin' ? 'Control+Minus' : 'Alt+ArrowLeft'
const forwardChord = process.platform === 'darwin' ? 'Control+Shift+Minus' : 'Alt+ArrowRight'

test.describe('Code navigation', () => {
  test.beforeEach(async ({ orcaPage, registerPostElectronShutdownCleanup }) => {
    await waitForSessionReady(orcaPage)
    await waitForActiveWorktree(orcaPage)
    const root = path.join(await worktreePath(orcaPage), FIXTURE_DIR)
    for (const [file, content] of Object.entries(FIXTURE_FILES)) {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      writeFileSync(path.join(root, file), content)
    }
    registerPostElectronShutdownCleanup(async () => rmSync(root, { recursive: true, force: true }))
  })

  test('jumps to a TypeScript definition through a re-export and back', async ({ orcaPage }) => {
    await openFixtureFile(orcaPage, 'app.ts', 'typescript')
    await definitionClick(orcaPage, "return greet('x')", 'greet')
    await expectActiveLocation(orcaPage, 'greet.ts', 3)

    // Focus without clicking: a click would move the cursor that Forward later returns to.
    await activeEditor(orcaPage).locator('.native-edit-context, textarea.inputarea').first().focus()
    await orcaPage.keyboard.press(backChord)
    await expectActiveLocation(orcaPage, 'app.ts', 4)

    await orcaPage.keyboard.press(forwardChord)
    await expectActiveLocation(orcaPage, 'greet.ts', 3)
  })

  test('jumps to a Python class imported from a sibling module', async ({ orcaPage }) => {
    await openFixtureFile(orcaPage, 'pkg/service.py', 'python')
    await definitionClick(orcaPage, 'return User()', 'User')
    await expectActiveLocation(orcaPage, 'models.py', 1)
  })

  test('shows an outline beside the code that follows the caret and jumps on click', async ({
    orcaPage
  }) => {
    await openFixtureFile(orcaPage, 'pkg/models.py', 'python')
    await expect(activeEditor(orcaPage).locator('.view-line').first()).toBeVisible({
      timeout: 20_000
    })
    await orcaPage.getByRole('button', { name: 'Outline', exact: true }).click()
    const outline = orcaPage.getByRole('complementary', { name: 'Outline' })
    await expect(outline).toBeVisible()
    const rowTitles = outline.locator('.markdown-toc-row .markdown-toc-title')
    await expect(rowTitles).toHaveText(['User', '__init__'])

    await outline
      .locator('.markdown-toc-row')
      .filter({ hasText: '__init__' })
      .locator('button')
      .last()
      .click()
    await expectActiveLocation(orcaPage, 'models.py', 2)
    await expect(outline.locator('.markdown-toc-row[data-current="true"]')).toContainText(
      '__init__'
    )

    await orcaPage.getByRole('button', { name: 'Outline', exact: true }).click()
    await expect(outline).toBeHidden()
  })
})
