import { describe, expect, it } from 'vitest'
import type { GitRefEntry } from '../../../../shared/git-log-page-types'
import {
  buildGitLogBranchRows,
  collectGitLogGroupKeys,
  gitLogToggledForAll,
  type GitLogBranchRow
} from './git-log-branch-tree'

function ref(kind: GitRefEntry['kind'], shortName: string, isHead = false): GitRefEntry {
  const prefix =
    kind === 'local' ? 'refs/heads/' : kind === 'remote' ? 'refs/remotes/' : 'refs/tags/'
  return {
    kind,
    shortName,
    fullName: `${prefix}${shortName}`,
    oid: 'a'.repeat(40),
    isHead
  }
}

const REFS = [
  ref('local', 'feature/b'),
  ref('local', 'main'),
  ref('local', 'build-web-issues', true),
  ref('remote', 'origin/main'),
  ref('remote', 'upstream/main'),
  ref('remote', 'upstream/team/x'),
  ref('tag', 'v1')
]

const labels = { local: 'Local', remote: 'Remote', tag: 'Tags' }

function render(rows: GitLogBranchRow[]): string[] {
  return rows.map((row) => {
    const mark = row.kind === 'group' ? (row.expanded ? '▾ ' : '▸ ') : ''
    const star = row.kind === 'branch' && row.isFavorite ? ' ★' : ''
    const current = row.kind === 'branch' && row.isCurrent ? ' (current)' : ''
    return `${'  '.repeat(row.depth)}${mark}${row.label}${star}${current}`
  })
}

describe('buildGitLogBranchRows', () => {
  it('opens Local and keeps Remote and Tags closed, favourites first', () => {
    const rows = buildGitLogBranchRows(REFS, {
      headLabel: 'HEAD (Current Branch)',
      sectionLabels: labels,
      query: '',
      groupByDirectory: true,
      toggled: new Set()
    })
    expect(render(rows)).toEqual([
      'HEAD (Current Branch)',
      '▾ Local',
      '  main ★',
      '  ▾ feature',
      '    b',
      '  build-web-issues (current)',
      '▸ Remote',
      '▸ Tags'
    ])
  })

  it('opens a toggled remote and groups its branches by directory', () => {
    const rows = buildGitLogBranchRows(REFS, {
      headLabel: 'HEAD',
      sectionLabels: labels,
      query: '',
      groupByDirectory: true,
      toggled: new Set(['remote', 'remote/upstream'])
    })
    expect(render(rows).slice(6)).toEqual([
      '▾ Remote',
      '  ▸ origin',
      '  ▾ upstream',
      '    main ★',
      '    ▸ team',
      '▸ Tags'
    ])
  })

  it('shows matches with their groups open while searching', () => {
    const rows = buildGitLogBranchRows(REFS, {
      headLabel: 'HEAD',
      sectionLabels: labels,
      query: 'team',
      groupByDirectory: true,
      toggled: new Set()
    })
    expect(render(rows)).toEqual(['HEAD', '▾ Remote', '  ▾ upstream', '    ▾ team', '      x'])
  })

  it('lists full names flat without grouping', () => {
    const rows = buildGitLogBranchRows(REFS, {
      headLabel: 'HEAD',
      sectionLabels: labels,
      query: '',
      groupByDirectory: false,
      toggled: new Set()
    })
    expect(render(rows).slice(1, 5)).toEqual([
      '▾ Local',
      '  main ★',
      '  build-web-issues (current)',
      '  feature/b'
    ])
  })
})

describe('expand and collapse all', () => {
  it('flips exactly the groups whose default differs', () => {
    const keys = collectGitLogGroupKeys(REFS, true)
    const open = gitLogToggledForAll(keys, true)
    const closed = gitLogToggledForAll(keys, false)
    expect([...open].sort()).toEqual(
      ['remote', 'remote/origin', 'remote/upstream', 'remote/upstream/team', 'tags'].sort()
    )
    expect([...closed].sort()).toEqual(['local', 'local/feature'])
  })
})
