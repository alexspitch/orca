import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DOCX_MIME_TYPE } from '../../../shared/document-file-extensions'
import { readLocalFileContent } from './filesystem-file-content-inspection'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'orca-file-content-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('readLocalFileContent', () => {
  it('sends a Word document as bytes for the document viewer, not the image one', async () => {
    const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0xff])
    const filePath = join(dir, 'Spec.DOCX')
    await writeFile(filePath, bytes)

    await expect(readLocalFileContent(filePath)).resolves.toEqual({
      content: bytes.toString('base64'),
      isBinary: true,
      mimeType: DOCX_MIME_TYPE
    })
  })

  it('still reports an old binary .doc as undisplayable', async () => {
    const filePath = join(dir, 'old.doc')
    await writeFile(filePath, Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x00]))

    await expect(readLocalFileContent(filePath)).resolves.toEqual({ content: '', isBinary: true })
  })
})
