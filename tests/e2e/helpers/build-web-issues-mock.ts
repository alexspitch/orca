import type http from 'node:http'

// build-web's task list and one task's card with files: of the task (Markdown, HTML, a picture,
// a video too large for a tab) and of a comment (a log), plus the files' own bytes. A second task
// has a plan and two mockups — an archive of two pages and a single page — served by token under
// `/mockups/` with the console's own sandbox, as build-web does.

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

const PLAN_ISSUE_ID = 'iss-plan'
const PLAN_ROW = { ...ROW, id: PLAN_ISSUE_ID, key: 'IS-901', title: 'Plan and mockups demo' }
// A subtask, found only by its own number — as build-web's search answers for one.
const SUB_ROW = {
  ...ROW,
  id: 'iss-sub',
  key: 'IS-901.1',
  title: 'Subtask demo',
  parent_id: PLAN_ISSUE_ID,
  parent_key: 'IS-901'
}
const PLAN_MD = [
  '# Plan of the fix',
  '',
  '- [x] Reproduce the dropped call',
  '- [ ] Patch the engine timeout',
  ''
].join('\n')
const roleFile = (id: string, name: string, mime: string, role: string, at: string) => ({
  id,
  name,
  size: 100,
  mime,
  comment_id: null,
  role,
  created_by: 'qa@box.test',
  created_at: at
})
const PLAN_FILES = [
  roleFile('p1p1p1p1p1p1', 'plan.md', 'text/markdown', 'plan', '2026-10-21T08:00:00Z'),
  roleFile('m1m1m1m1m1m1', 'screens.zip', 'application/zip', 'mockup', '2026-10-21T09:00:00Z'),
  roleFile('m2m2m2m2m2m2', 'login.html', 'text/html', 'mockup', '2026-10-20T09:00:00Z')
]
const MOCKUP_SCREENS: Record<string, string[]> = {
  m1m1m1m1m1m1: ['index.html', 'pages/settings.html'],
  m2m2m2m2m2m2: ['login.html']
}
const MOCKUP_PAGES: Record<string, { type: string; body: string }> = {
  'index.html': {
    type: 'text/html; charset=utf-8',
    body: '<!doctype html><link rel="stylesheet" href="style.css"><h1 id="home">Mockup home screen</h1>'
  },
  'style.css': { type: 'text/css', body: '#home { color: rgb(200, 0, 0); }' },
  'pages/settings.html': {
    type: 'text/html; charset=utf-8',
    body: '<!doctype html><h1>Mockup settings screen</h1>'
  },
  'login.html': {
    type: 'text/html; charset=utf-8',
    body: '<!doctype html><h1>Mockup login page</h1>'
  }
}
// The console's policy for a mockup: sandboxed, and no frame-ancestors, so Orca's card can frame it.
const MOCKUP_CSP = "sandbox allow-scripts; default-src * data: blob: 'unsafe-inline' 'unsafe-eval'"

function servePlanIssue(
  res: http.ServerResponse,
  path: string,
  json: (res: http.ServerResponse, status: number, body: unknown) => void
): boolean {
  const view = /^\/api\/tms\/issues\/iss-plan\/files\/([^/]+)\/view$/.exec(path)
  const page = /^\/mockups\/tok-([^/]+)\/(.+)$/.exec(path)
  if (path === '/api/tms/issues/iss-sub') {
    json(res, 200, {
      issue: { ...SUB_ROW, description: 'A part of the fix.', steps: [] },
      branches: ['master'],
      comments: [],
      files: []
    })
  } else if (path === `/api/tms/issues/${PLAN_ISSUE_ID}`) {
    json(res, 200, {
      issue: { ...PLAN_ROW, description: 'Calls drop on the stand.', steps: [] },
      branches: ['master'],
      comments: [],
      files: PLAN_FILES
    })
  } else if (path === `/api/tms/issues/${PLAN_ISSUE_ID}/files/p1p1p1p1p1p1`) {
    res.writeHead(200, { 'content-type': 'text/markdown' })
    res.end(PLAN_MD)
  } else if (view) {
    json(res, 200, {
      base: `/mockups/tok-${view[1]}/`,
      screens: (MOCKUP_SCREENS[view[1]] ?? []).map((name) => ({ name, path: name }))
    })
  } else if (page && MOCKUP_PAGES[page[2]]) {
    res.writeHead(200, {
      'content-type': MOCKUP_PAGES[page[2]].type,
      'content-security-policy': MOCKUP_CSP
    })
    res.end(MOCKUP_PAGES[page[2]].body)
  } else {
    return false
  }
  return true
}

// The Issues badge's question — tasks sorted by priority — answered with an open blocker and a
// closed one, within the statuses asked for, as the console filters them.
const BLOCKERS = [
  { ...ROW, id: 'iss-blocker', key: 'IS-910', title: 'Calls lost', priority: 5 },
  { ...ROW, id: 'iss-done', key: 'IS-911', title: 'Fixed blocker', priority: 5, status: 'done' }
]

/** The statuses each badge question asked for, in order; the spec clears it. */
export const blockerQueries: (string | null)[] = []

/** The patches sent to the files demo task, and its status as they left it. */
export const issuePatches: Record<string, unknown>[] = []
let filesIssueStatus = ROW.status

export function resetIssuePatches(): void {
  issuePatches.length = 0
  filesIssueStatus = ROW.status
}

/** PATCH /api/tms/issues/:id of the files demo task: keeps the status, answers the row. */
export function patchFilesIssue(
  id: string,
  body: Record<string, unknown>
): { issue: Record<string, unknown> } | null {
  if (id !== ISSUE_ID) {
    return null
  }
  issuePatches.push(body)
  if (typeof body.status === 'string') {
    filesIssueStatus = body.status
  }
  return { issue: { ...ROW, status: filesIssueStatus } }
}

export function serveIssues(
  res: http.ServerResponse,
  path: string,
  url: URL,
  json: (res: http.ServerResponse, status: number, body: unknown) => void
): boolean {
  if (servePlanIssue(res, path, json)) {
    return true
  }
  if (path === '/api/tms/issues' && url.searchParams.get('sort') === 'priority') {
    blockerQueries.push(url.searchParams.get('status'))
    const statuses = url.searchParams.get('status')?.split(',')
    const rows = BLOCKERS.filter((row) => !statuses || statuses.includes(row.status))
    json(res, 200, { issues: rows, total: rows.length })
  } else if (path === '/api/tms/issues') {
    const rows =
      url.searchParams.get('q') === SUB_ROW.key
        ? [SUB_ROW]
        : [{ ...ROW, status: filesIssueStatus }, PLAN_ROW]
    json(res, 200, { issues: rows, total: rows.length })
  } else if (path === '/api/tms/issues/assignees') {
    json(res, 200, { users: [] })
  } else if (path === '/api/tms/versions') {
    json(res, 200, { versions: [] })
  } else if (path === `/api/tms/issues/${ISSUE_ID}`) {
    json(res, 200, {
      issue: { ...ROW, status: filesIssueStatus, description: 'The stand drops calls.', steps: [] },
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
