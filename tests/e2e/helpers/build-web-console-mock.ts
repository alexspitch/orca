import http from 'node:http'

// A build-web console on loopback with the stand routes the Stands page reads, plus a stand UI (on
// `localhost`) whose auth portal (on `127.0.0.1`, another host, as on the real stands) records what
// was typed into its login form.

export type BuildWebConsoleMock = {
  baseUrl: string
  /** The stand's UI, on another host than its portal. */
  uiUrl: string
  password: string
  logins: { username: string; password: string }[]
  ops: { standId: string; kind: string; services: string[] }[]
  openLogStreams: () => number
  close: () => Promise<void>
}

const PASSWORD = 's3cr3t-e2e'

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let text = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => (text += chunk))
    req.on('end', () => resolve(text))
  })
}

const LOGIN_PAGE = `<!doctype html><html><body>
<form method="post" action="/login">
  <input name="username" />
  <input name="password" type="password" />
  <button id="submit" type="submit">Sign in</button>
</form></body></html>`

export async function startBuildWebConsoleMock(): Promise<BuildWebConsoleMock> {
  const logins: BuildWebConsoleMock['logins'] = []
  const ops: BuildWebConsoleMock['ops'] = []
  let openStreams = 0
  let jobReads = 0
  let base = ''
  let ui = ''

  const card = (over: Record<string, unknown>) => ({
    ssh_host: '10.0.0.1',
    dir: '/opt/box/3.1',
    branch: 'release/3.1',
    enabled: true,
    lock: null,
    ui_url: `${ui}/app`,
    ...over
  })

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://mock')
    const path = url.pathname
    if (path.startsWith('/api/') && req.headers.authorization !== 'Bearer bwt_e2e') {
      return json(res, 401, { error: 'no token' })
    }
    if (path === '/api/me') {
      return json(res, 200, { authed: true, user: 'qa@box.test', perms: ['stands'] })
    }
    if (path === '/api/stands') {
      return json(res, 200, {
        stands: [
          card({ id: 'c-dc', name: '3.1 box DC', product: 'dc', products: ['dc'] }),
          card({ id: 'c-ap', name: '3.1 box AP', product: 'ap', products: ['ap'] }),
          card({
            id: 'c-st',
            name: 'storage box',
            dir: '/opt/storage',
            product: 'storage',
            products: []
          }),
          card({
            id: 'c-sa',
            name: 'sa 2.16',
            dir: '/opt/sa/2.16',
            branch: 'master',
            product: 'sa',
            products: ['sa'],
            lock: { held_by: 'deploy:j9', since: '2026-10-19T06:00:00Z' }
          })
        ]
      })
    }
    if (/^\/api\/stands\/[^/]+\/status$/.test(path)) {
      return json(res, 200, {
        services: [
          {
            service: 'ib-script-engine',
            image: 'docker.spitch.ch/dc/ib-script-engine:3.1',
            state: 'running',
            health: 'healthy',
            status: 'Up 2 hours (healthy)',
            container: 'box-ib-1',
            running_image: 'docker.spitch.ch/dc/ib-script-engine:3.1',
            build: '3.1b11830',
            image_created: '2026-10-18T21:05:11Z',
            started_at: '2026-10-19T06:00:00Z'
          },
          {
            service: 'kb-external-mock',
            image: 'dc/kb-mock:latest',
            state: 'exited',
            health: '',
            status: 'Exited (1) 3 minutes ago',
            container: 'box-kb-1',
            running_image: 'dc/kb-mock:latest',
            build: null,
            started_at: '2026-10-19T07:00:00Z'
          },
          {
            service: 'rabbitmq',
            image: 'rabbitmq:3.12-management',
            state: 'absent',
            health: '',
            status: '',
            container: null,
            running_image: null,
            build: null,
            started_at: null
          }
        ],
        details_error: null
      })
    }
    const logs = /^\/api\/stands\/[^/]+\/services\/([^/]+)\/logs$/.exec(path)
    if (logs) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
      for (let i = 1; i <= 30; i++) {
        res.write(
          `2026-10-19T06:00:${String(i).padStart(2, '0')}Z ${i % 10 === 0 ? 'ERROR' : 'INFO'} line ${i}\n`
        )
      }
      if (url.searchParams.get('follow') !== '1') {
        return res.end()
      }
      openStreams++
      let tick = 0
      const timer = setInterval(() => res.write(`tick ${++tick}\n`), 300)
      req.on('close', () => {
        clearInterval(timer)
        openStreams--
      })
      return
    }
    if (path === '/api/ui-accounts') {
      const stand = url.searchParams.get('stand')
      return json(res, 200, {
        accounts:
          stand === 'c-dc'
            ? [
                {
                  id: 'acc-admin',
                  description: 'Administrator',
                  email: 'admin@box.test',
                  stand_id: 'c-dc',
                  role_key: 'admin',
                  project_name: 'Default',
                  password: 'set'
                },
                {
                  id: 'acc-np',
                  description: 'Operator',
                  email: 'np@box.test',
                  stand_id: 'c-dc',
                  role_key: 'operator',
                  project_name: '',
                  password: 'missing'
                }
              ]
            : stand === 'c-ap'
              ? [
                  {
                    id: 'acc-ap',
                    description: 'AP admin',
                    email: 'ap@box.test',
                    stand_id: 'c-ap',
                    role_key: 'admin',
                    project_name: '',
                    password: 'set'
                  }
                ]
              : []
      })
    }
    if (path === '/api/ui-accounts/acc-admin/credentials' && req.method === 'POST') {
      return json(res, 200, {
        email: 'admin@box.test',
        password: PASSWORD,
        ui_url: `${ui}/app`,
        stand_id: 'c-dc',
        stand_name: '3.1 box DC'
      })
    }
    const op = /^\/api\/stands\/([^/]+)\/ops$/.exec(path)
    if (op && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}')
      ops.push({ standId: op[1], kind: body.kind, services: body.services ?? [] })
      jobReads = 0
      return json(res, 201, { op: { id: 'job-1', kind: body.kind, status: 'queued', error: null } })
    }
    if (path === '/api/deploys') {
      return json(res, 200, { deploys: [] })
    }
    if (path === '/api/deploys/job-1') {
      jobReads++
      const kind = ops.at(-1)?.kind ?? 'restart'
      return json(res, 200, {
        deploy: { id: 'job-1', kind, status: jobReads > 1 ? 'success' : 'running', error: null }
      })
    }
    if (path === '/api/deploys/job-1/log') {
      return json(res, 200, { log: '::phase:: compose\nok\n', running: false })
    }
    // The UI keeps its own session cookie; signing in goes through the portal and its callback.
    const signedIn = (req.headers.cookie ?? '').includes('app_session=1')
    const portalLogin = `${base}/login?response_type=code&client_id=dc&redirect_uri=${encodeURIComponent(`${ui}/dc_callback`)}`
    if (path === '/app' || (path === '/app/home' && !signedIn)) {
      res.writeHead(302, { location: signedIn ? '/app/home' : portalLogin })
      return res.end()
    }
    if (path === '/login' && req.method === 'POST') {
      const form = new URLSearchParams(await readBody(req))
      logins.push({ username: form.get('username') ?? '', password: form.get('password') ?? '' })
      res.writeHead(302, { location: `${ui}/dc_callback` })
      return res.end()
    }
    if (path === '/dc_callback') {
      res.writeHead(302, { location: '/app/home', 'set-cookie': 'app_session=1; Path=/' })
      return res.end()
    }
    if (path === '/logout') {
      res.writeHead(302, { location: portalLogin, 'set-cookie': 'app_session=; Path=/; Max-Age=0' })
      return res.end()
    }
    if (path === '/login' || path === '/app/home') {
      res.writeHead(200, { 'content-type': 'text/html' })
      return res.end(
        path === '/login' ? LOGIN_PAGE : '<p>Signed in</p><a href="/logout">Log out</a>'
      )
    }
    json(res, 404, { error: 'not here' })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('the mock console has no port')
  }
  base = `http://127.0.0.1:${address.port}`
  ui = `http://localhost:${address.port}`
  return {
    baseUrl: base,
    uiUrl: ui,
    password: PASSWORD,
    logins,
    ops,
    openLogStreams: () => openStreams,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      })
  }
}
