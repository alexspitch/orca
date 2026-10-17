import { getMainHttpClient } from '../network/http-client'
import { readFetchResponseJsonWithinLimit } from '../../shared/fetch-response-body'
import { recordOf, textOf, textsOf } from './build-web-response-fields'

const REQUEST_TIMEOUT_MS = 20_000
// Why: one answer must fit the remote RPC frame on its way to a paired client.
const RESPONSE_MAX_BYTES = 8 * 1024 * 1024

/** A refusal from the console, kept apart from the network failing. */
export class BuildWebApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly needsPermission: string[] = []
  ) {
    super(message)
    this.name = 'BuildWebApiError'
  }
}

export class BuildWebUnreachableError extends Error {
  constructor(baseUrl: string, cause: unknown) {
    // Why: the cause names the reason (refused, TLS, DNS) — never the request, which carries the token.
    const why = cause instanceof Error ? cause.message : String(cause)
    super(`build-web at ${baseUrl} is unreachable: ${why}`)
    this.name = 'BuildWebUnreachableError'
  }
}

/**
 * The console's origin from what a person typed, or null. HTTPS only (plain HTTP just for
 * loopback), no `user:pass@`, and no path: the token must go to exactly this origin.
 */
export function normalizeBuildWebBaseUrl(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.username || url.password) {
    return null
  }
  const loopback =
    url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    return null
  }
  return url.origin
}

export type BuildWebRequest = {
  baseUrl: string
  token: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
}

/** One call to the console's API. Returns the parsed JSON, or throws a typed error. */
export async function buildWebRequest(request: BuildWebRequest): Promise<unknown> {
  const timeout = AbortSignal.timeout(request.timeoutMs ?? REQUEST_TIMEOUT_MS)
  const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout
  const headers: Record<string, string> = {
    authorization: `Bearer ${request.token}`,
    accept: 'application/json'
  }
  if (request.body !== undefined) {
    headers['content-type'] = 'application/json'
  }
  let response: Response
  try {
    response = await getMainHttpClient().fetch(`${request.baseUrl}${request.path}`, {
      method: request.method ?? 'GET',
      headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      // Why: a redirect would carry the bearer token to wherever the console points.
      redirect: 'error',
      signal
    })
  } catch (error) {
    throw new BuildWebUnreachableError(request.baseUrl, error)
  }
  if (response.ok) {
    return readFetchResponseJsonWithinLimit<unknown>(response, RESPONSE_MAX_BYTES)
  }
  const data = recordOf(
    await readFetchResponseJsonWithinLimit<unknown>(response, 64 * 1024).catch(() => null)
  )
  const said = textOf(data?.error) || response.statusText || `HTTP ${response.status}`
  throw new BuildWebApiError(said, response.status, textsOf(data?.needsPermission))
}

/** A binary answer (a guide screenshot), capped so one image cannot fill memory or an RPC frame. */
export async function buildWebBinaryRequest(
  request: Omit<BuildWebRequest, 'method' | 'body'> & { maxBytes: number }
): Promise<{ mime: string; bytes: Uint8Array }> {
  let response: Response
  try {
    response = await getMainHttpClient().fetch(`${request.baseUrl}${request.path}`, {
      headers: { authorization: `Bearer ${request.token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(request.timeoutMs ?? REQUEST_TIMEOUT_MS)
    })
  } catch (error) {
    throw new BuildWebUnreachableError(request.baseUrl, error)
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {})
    throw new BuildWebApiError(response.statusText || `HTTP ${response.status}`, response.status)
  }
  const mime = response.headers.get('content-type') ?? 'application/octet-stream'
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > request.maxBytes || !mime.startsWith('image/')) {
    await response.body?.cancel().catch(() => {})
    throw new BuildWebApiError('not an image within the size limit', 413)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > request.maxBytes) {
    throw new BuildWebApiError('image too large', 413)
  }
  return { mime, bytes }
}

/** Plain words for a failure, for a toast or an inline error. */
export function describeBuildWebError(error: unknown): string {
  if (error instanceof BuildWebApiError) {
    if (error.status === 401) {
      return 'build-web rejected the token. Issue a new one in build-web (key icon) and reconnect.'
    }
    if (error.status === 403) {
      const needs = error.needsPermission.length
        ? ` Needs section: ${error.needsPermission.join(' or ')}.`
        : ''
      return `${error.message}.${needs}`
    }
    return error.message
  }
  return error instanceof Error ? error.message : String(error)
}
