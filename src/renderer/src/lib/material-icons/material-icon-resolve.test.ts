import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import {
  materialIconFile,
  materialIconName,
  type MaterialIconManifest
} from './material-icon-resolve'

// The Explorer's Material icons, read from the theme's own manifest as VS Code reads it.

const manifest: MaterialIconManifest = JSON.parse(
  readFileSync(
    createRequire(import.meta.url).resolve('material-icon-theme/dist/material-icons.json'),
    'utf8'
  )
)

const icon = (name: string, kind: 'file' | 'folder' | 'folder-open' = 'file', light = false) =>
  materialIconName(manifest, name, kind, light)

describe('which Material icon a row gets', () => {
  it('takes a whole file name before its extension, in any case', () => {
    expect(icon('package.json')).toBe('nodejs')
    expect(icon('README.md')).toBe('readme')
    expect(icon('Dockerfile')).toBe('docker')
  })

  it('takes the longest extension first', () => {
    expect(icon('button.spec.ts')).toBe('test-ts')
    expect(icon('types.d.ts')).toBe('typescript-def')
    expect(icon('index.ts')).toBe('typescript')
    expect(icon('App.tsx')).toBe('react_ts')
  })

  it('falls back to the plain file and folder icons', () => {
    expect(icon('notes.unknown-extension')).toBe('file')
    expect(icon('no-extension')).toBe('file')
    expect(icon('some-folder-nobody-names', 'folder')).toBe('folder')
    expect(icon('some-folder-nobody-names', 'folder-open')).toBe('folder-open')
  })

  it('draws a named folder open or closed', () => {
    expect(icon('src', 'folder')).toBe('folder-src')
    expect(icon('src', 'folder-open')).toBe('folder-src-open')
    expect(icon('tests', 'folder')).toBe('folder-test')
  })

  it('uses the light variant on a light background', () => {
    expect(icon('template.jinja')).toBe('jinja')
    expect(icon('template.jinja', 'file', true)).toBe('jinja_light')
  })

  it('names each icon by its SVG file', () => {
    expect(materialIconFile(manifest, 'typescript')).toBe('typescript')
    expect(materialIconFile(manifest, 'no-such-icon')).toBeNull()
  })
})
