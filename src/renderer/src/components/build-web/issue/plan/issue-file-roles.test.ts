import { describe, expect, it } from 'vitest'
import type { BuildWebIssueFile } from '../../../../../../shared/build-web-types'
import { filesWithRole, planProgress } from './issue-file-roles'

const file = (over: Partial<BuildWebIssueFile>): BuildWebIssueFile => ({
  id: 'f',
  name: 'plan.md',
  size: 10,
  mime: 'text/markdown',
  comment_id: null,
  role: 'plan',
  created_by: 'qa@box.test',
  created_at: '2026-10-20T08:00:00Z',
  ...over
})

describe('filesWithRole', () => {
  it('lists the task’s own files of that role, the newest first', () => {
    const files = [
      file({ id: 'old', created_at: '2026-10-19T08:00:00Z' }),
      file({ id: 'new', created_at: '2026-10-21T08:00:00Z' }),
      file({ id: 'comment', comment_id: 'c1' }),
      file({ id: 'mockup', role: 'mockup' }),
      file({ id: 'plain', role: '' }),
      file({ id: 'older-host', role: undefined })
    ]
    expect(filesWithRole(files, 'plan').map((f) => f.id)).toEqual(['new', 'old'])
    expect(filesWithRole(files, 'mockup').map((f) => f.id)).toEqual(['mockup'])
  })
})

describe('planProgress', () => {
  it('counts ticked and open steps, outside fenced blocks', () => {
    const plan = [
      '# Plan',
      '- [x] read the code',
      '* [X] write the test',
      '1. [ ] ship it',
      '- not a step',
      '```md',
      '- [ ] an example, not a step',
      '```'
    ].join('\n')
    expect(planProgress(plan)).toEqual({ done: 2, total: 3 })
  })
})
