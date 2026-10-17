import { describe, expect, it } from 'vitest'
import { guideShotSlugs, nextStatus, readsRuns, withShotUrls, writesRuns } from './issue-card-facts'
import { diffFilesOf } from './commit-diff-rows'

describe('card facts', () => {
  it('moves a task one step, a subtask straight to done', () => {
    expect(nextStatus('todo', false)).toBe('inprogress')
    expect(nextStatus('inprogress', false)).toBe('deploying')
    expect(nextStatus('inprogress', true)).toBe('done')
    expect(nextStatus('build_failed', false)).toBe('deploying')
    expect(nextStatus('testing_external', false)).toBe('done')
    expect(nextStatus('wontfix', false)).toBeNull()
    expect(nextStatus('unknown', false)).toBeNull()
  })

  it('shows run tabs for build or history, and writes only for build', () => {
    expect(readsRuns(['history'])).toBe(true)
    expect(readsRuns(['issues'])).toBe(false)
    expect(writesRuns(['history'])).toBe(false)
    expect(writesRuns(['build'])).toBe(true)
  })

  it('points guide screenshots at blob URLs and drops the ones it could not read', () => {
    const md = 'a ![login](shot:login-1) b ![](shot:x_2) ![web](https://e.test/p.png)'
    expect(guideShotSlugs(md)).toEqual(['login-1', 'x_2'])
    expect(withShotUrls(md, { 'login-1': 'blob:1' })).toBe(
      'a ![login](blob:1) b [x_2] ![web](https://e.test/p.png)'
    )
  })
})

describe('commit diff rows', () => {
  const patch = [
    'diff --git a/src/a.ts b/src/a.ts',
    '--- a/src/a.ts',
    '+++ b/src/a.ts',
    '@@ -1,3 +1,3 @@',
    ' keep',
    '-old',
    '+new',
    ' tail',
    'diff --git a/n.ts b/n.ts',
    '--- /dev/null',
    '+++ b/n.ts',
    '@@ -0,0 +1 @@',
    '+fresh',
    ''
  ].join('\n')

  it('pairs removals with additions and keeps line numbers', () => {
    const [changed, added] = diffFilesOf(patch)
    expect(changed).toMatchObject({ path: 'src/a.ts', status: 'changed', added: 1, removed: 1 })
    expect(changed.rows[1]).toEqual({
      left: { line: 2, text: 'old', kind: 'removed' },
      right: { line: 2, text: 'new', kind: 'added' }
    })
    expect(added).toMatchObject({ path: 'n.ts', status: 'added', added: 1, removed: 0 })
  })
})

describe('a patch the parser refuses', () => {
  it('keeps the readable files and shows a cut one as text', () => {
    const patch = [
      'diff --git a/ok.ts b/ok.ts',
      '--- a/ok.ts',
      '+++ b/ok.ts',
      '@@ -1 +1 @@',
      '-a',
      '+b',
      'diff --git a/cut.ts b/cut.ts',
      '--- a/cut.ts',
      '+++ b/cut.ts',
      '@@ -1,5 +1,5 @@',
      '-x'
    ].join('\n')
    const files = diffFilesOf(patch)
    expect(files.map((f) => f.path)).toEqual(['ok.ts', 'cut.ts'])
    expect(files[0]).toMatchObject({ added: 1, removed: 1 })
    expect(files[1].rows[0].left.text).toBe('diff --git a/cut.ts b/cut.ts')
  })
})
