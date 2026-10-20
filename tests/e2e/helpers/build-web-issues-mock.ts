import type http from 'node:http'

// build-web's task list and one task's card with files: of the task (Markdown, HTML, a picture,
// a video too large for a tab) and of a comment (a log), plus the files' own bytes.

const ISSUE_ID = 'iss-files'
const ROW = {
  id: ISSUE_ID,
  key: 'IS-900',
  product: 'dc',
  title: 'Attachments demo',
  type: 'bug',
  status: 'todo',
  priority: 3,
  assignee: '',
  updated_at: '2026-10-20T08:00:00Z'
}

// A 1×1 PNG.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

const FILES: Record<
  string,
  { name: string; mime: string; body: Buffer; comment_id: string | null }
> = {
  a1a1a1a1a1a1: {
    name: 'notes.md',
    mime: 'text/markdown',
    body: Buffer.from('# Notes from the attachment\n\nSteps that **fail** on the stand.\n'),
    comment_id: null
  },
  b2b2b2b2b2b2: {
    name: 'report.html',
    mime: 'text/html',
    body: Buffer.from('<!doctype html><title>report</title><h1>Report from the attachment</h1>'),
    comment_id: null
  },
  c3c3c3c3c3c3: { name: 'shot.png', mime: 'image/png', body: PIXEL, comment_id: null },
  d4d4d4d4d4d4: {
    name: 'run.log',
    mime: 'text/plain',
    body: Buffer.from('12:00 call started\n12:01 engine timeout\n'),
    comment_id: 'cm-1'
  }
}

const fileRows = () => [
  ...Object.entries(FILES).map(([id, f]) => ({
    id,
    name: f.name,
    size: f.body.length,
    mime: f.mime,
    comment_id: f.comment_id,
    created_by: 'qa@box.test',
    created_at: '2026-10-20T08:00:00Z'
  })),
  {
    id: 'e5e5e5e5e5e5',
    name: 'call.mp4',
    size: 48 * 1024 * 1024,
    mime: 'video/mp4',
    comment_id: null,
    created_by: 'qa@box.test',
    created_at: '2026-10-20T08:00:00Z'
  }
]

export function serveIssues(
  res: http.ServerResponse,
  path: string,
  json: (res: http.ServerResponse, status: number, body: unknown) => void
): boolean {
  if (path === '/api/tms/issues') {
    json(res, 200, { issues: [ROW], total: 1 })
  } else if (path === '/api/tms/issues/assignees') {
    json(res, 200, { users: [] })
  } else if (path === '/api/tms/versions') {
    json(res, 200, { versions: [] })
  } else if (path === `/api/tms/issues/${ISSUE_ID}`) {
    json(res, 200, {
      issue: { ...ROW, description: 'The stand drops calls.', steps: [] },
      branches: ['master'],
      comments: [
        {
          id: 'cm-1',
          author: 'qa@box.test',
          body: 'The log of the failed call.',
          created_at: '2026-10-20T08:05:00Z'
        }
      ],
      files: fileRows()
    })
  } else if (path.startsWith(`/api/tms/issues/${ISSUE_ID}/files/`)) {
    const file = FILES[path.split('/').pop() ?? '']
    if (!file) {
      json(res, 404, { error: 'no such file' })
    } else {
      res.writeHead(200, { 'content-type': file.mime })
      res.end(file.body)
    }
  } else {
    return false
  }
  return true
}
