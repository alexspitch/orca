import { describe, expect, it, vi } from 'vitest'
import { mkdir, realpath, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type * as FsPromises from 'node:fs/promises'
import { lstatMock, readdirMock } from './orca-runtime-files-mock-registry'
import {
  createRuntimeFileCommands,
  useRuntimeFileCommandsLifecycle
} from './orca-runtime-files-test-harness'
import {
  resolveTerminalArtifactPath,
  statAsFile,
  useTerminalArtifactTempFiles
} from './orca-runtime-files-terminal-artifact-fixtures'

vi.mock('fs', async () => (await import('./orca-runtime-files-mock-registry')).fsModuleMock())
vi.mock('fs/promises', async () =>
  (await import('./orca-runtime-files-mock-registry')).fsPromisesModuleMock()
)
vi.mock(
  './file-watcher-host',
  async () => (await import('./orca-runtime-files-mock-registry')).fileWatcherHostMock
)
vi.mock('../ipc/filesystem/filesystem-auth', async () =>
  (await import('./orca-runtime-files-mock-registry')).filesystemAuthModuleMock()
)
vi.mock('../git/runner', async () =>
  (await import('./orca-runtime-files-mock-registry')).gitRunnerModuleMock()
)
vi.mock(
  '../ipc/local-worktree-runtime-options',
  async () => (await import('./orca-runtime-files-mock-registry')).localWorktreeRuntimeOptionsMock
)

// A folder a terminal printed under the temp dir (an agent's scratchpad): listed, its files granted one by one.

function directoryTarget(result: { openTarget?: { kind: string } }): {
  absolutePath: string
  grantId: string
} {
  const target = result.openTarget
  if (target?.kind !== 'absolute-directory' || !('grantId' in target)) {
    throw new Error('Expected a terminal folder target')
  }
  return target as { absolutePath: string; grantId: string }
}

describe('terminal artifact folders', () => {
  useRuntimeFileCommandsLifecycle()
  const { tempFile } = useTerminalArtifactTempFiles()

  async function realFs() {
    const actual = await vi.importActual<typeof FsPromises>('fs/promises')
    lstatMock.mockImplementation(actual.lstat)
    readdirMock.mockImplementation(actual.readdir)
  }

  async function scratchpad() {
    await realFs()
    const index = await tempFile('index.html', '<h1>ui</h1>')
    const root = await realpath(dirname(index))
    await mkdir(join(root, 'css'))
    await writeFile(join(root, 'css', 'app.css'), 'body{}')
    statAsFile()
    const { commands } = createRuntimeFileCommands({ path: '/repo' })
    const folder = directoryTarget(await resolveTerminalArtifactPath(commands, `${root}/`))
    return { root, commands, folder }
  }

  it('lists the files of a printed folder and reads one of them through its own grant', async () => {
    const { commands, folder } = await scratchpad()
    const listing = await commands.listTerminalArtifactDirectory(
      'id:wt-1',
      folder.grantId,
      folder.absolutePath,
      'client-a'
    )
    expect(listing).toEqual({
      entries: [
        { relativePath: 'css/app.css', size: 6 },
        { relativePath: 'index.html', size: 11 }
      ],
      truncated: false
    })
    const file = await commands.grantTerminalArtifactDirectoryFile(
      'id:wt-1',
      folder.grantId,
      folder.absolutePath,
      'css/app.css',
      'client-a'
    )
    if (file.openTarget?.kind !== 'absolute-file') {
      throw new Error('Expected a file grant')
    }
    expect(file.openTarget.readOnly).toBe(true)
    const chunk = await commands.readTerminalArtifactChunk(
      'id:wt-1',
      file.openTarget.grantId,
      file.openTarget.absolutePath,
      0,
      1024,
      'client-a'
    )
    expect(Buffer.from(chunk.contentBase64, 'base64').toString()).toBe('body{}')
    expect(chunk.eof).toBe(true)
  })

  it('grants nothing outside the folder, through .. or a link', async () => {
    const { root, commands, folder } = await scratchpad()
    const outside = await tempFile('secret.txt', 'no')
    await symlink(outside, join(root, 'link.txt'))
    for (const relativePath of ['../secret.txt', 'link.txt']) {
      await expect(
        commands.grantTerminalArtifactDirectoryFile(
          'id:wt-1',
          folder.grantId,
          folder.absolutePath,
          relativePath,
          'client-a'
        )
      ).rejects.toThrow('terminal_file_grant_mismatch')
    }
    const listing = await commands.listTerminalArtifactDirectory(
      'id:wt-1',
      folder.grantId,
      folder.absolutePath,
      'client-a'
    )
    expect(listing.entries.map((e) => e.relativePath)).not.toContain('link.txt')
  })

  it('refuses another client the folder grant', async () => {
    const { commands, folder } = await scratchpad()
    await expect(
      commands.listTerminalArtifactDirectory(
        'id:wt-1',
        folder.grantId,
        folder.absolutePath,
        'client-b'
      )
    ).rejects.toThrow('terminal_file_grant_mismatch')
  })

  it('never grants the temp dir itself', async () => {
    statAsFile()
    const { commands } = createRuntimeFileCommands({ path: '/repo' })
    const result = await resolveTerminalArtifactPath(commands, await realpath(tmpdir()))
    expect(result.openTarget).toBeUndefined()
  })
})
