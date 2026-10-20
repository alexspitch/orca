import { getMainHttpClient } from '../network/http-client'
import {
  API_RESPONSE_JSON_LIMITS,
  FetchResponseBodyTooLargeError,
  readFetchResponseBytesWithinLimit,
  readFetchResponseJsonWithinLimit
} from '../../shared/fetch-response-body'
import type { BuildWebMutationResult } from '../../shared/build-web-types'
import { REMOTE_RPC_MAX_CONTENT_BYTES } from '../../shared/remote-rpc-content-budget'
import { BUILD_WEB_REQUEST_TIMEOUT_MS } from '../../shared/build-web-timeouts'
import { recordOf, textOf, textsOf } from './build-web-response-fields'

// Why: one answer must fit a remote RPC reply on its way to a paired client.
const RESPONSE_MAX_BYTES = REMOTE_RPC_MAX_CONTENT_BYTES

/** A larger cap for answers main digests itself and never forwards whole (the build catalog). */
export type BuildWebResponseLimit = { bytes: number; structuralTokens: number }

/** A refusal from the console, kept apart from the network failing. */
export class BuildWebApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly needsPermission: string[] = [],
    /** 404/405 without the console's JSON error: the route itself is absent (an older console). */
    readonly routeMissing = false
  ) {
    super(message)
    this.name = 'BuildWebApiError'
  }
}

export class BuildWebUnreachableError extends Error {
  constructor(baseUrl: string, cause: unknown, token: string) {
    // Why: the cause names the reason (refused, TLS, DNS), but a header check quotes the header
    // value — so the token, and any piece of it, is cut out before the message goes anywhere.
    const raw = cause instanceof Error ? cause.message : String(cause)
    const why = redactToken(raw, token)
    super(`build-web at ${baseUrl} is unreachable: ${why}`)
    this.name = 'BuildWebUnreachableError'
  }
}

function redactToken(text: string, token: string): string {
  let out = text
  for (const piece of [token, ...token.split(/\s+/)].filter((p) => p.length >= 4)) {
    out = out.split(piece).join('[token]')
  }
  return out
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
  responseLimit?: BuildWebResponseLimit
}

function requestSignal(request: Pick<BuildWebRequest, 'signal' | 'timeoutMs'>): AbortSignal {
  const timeout = AbortSignal.timeout(request.timeoutMs ?? BUILD_WEB_REQUEST_TIMEOUT_MS)
  return request.signal ? AbortSignal.any([request.signal, timeout]) : timeout
}

/** One call to the console's API. Returns the parsed JSON, or throws a typed error. */
export async function buildWebRequest(request: BuildWebRequest): Promise<unknown> {
  const signal = requestSignal(request)
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
    throw new BuildWebUnreachableError(request.baseUrl, error, request.token)
  }
  if (response.ok) {
    const limit = request.responseLimit
    return limit
      ? readFetchResponseJsonWithinLimit<unknown>(response, limit.bytes, {
          ...API_RESPONSE_JSON_LIMITS,
          structuralTokens: limit.structuralTokens
        })
      : readFetchResponseJsonWithinLimit<unknown>(response, RESPONSE_MAX_BYTES)
  }
  throw await refusalOf(response)
}

/** The console's refusal, from its JSON `{ error, needsPermission }` when it sent one. */
async function refusalOf(response: Response): Promise<BuildWebApiError> {
  const data = recordOf(
    await readFetchResponseJsonWithinLimit<unknown>(response, 64 * 1024).catch(() => null)
  )
  const said = textOf(data?.error) || response.statusText || `HTTP ${response.status}`
  const routeMissing = (response.status === 404 || response.status === 405) && !textOf(data?.error)
  return new BuildWebApiError(said, response.status, textsOf(data?.needsPermission), routeMissing)
}

/**
 * A long-lived text answer (a guide being written, a followed log), returned open for the caller
 * to read. A refusal throws like any other call.
 */
export async function buildWebStreamRequest(
  request: Omit<BuildWebRequest, 'responseLimit' | 'timeoutMs'> & { signal: AbortSignal }
): Promise<Response> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${request.token}`,
    accept: 'text/plain, application/json'
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
      signal: request.signal
    })
  } catch (error) {
    throw new BuildWebUnreachableError(request.baseUrl, error, request.token)
  }
  if (!response.ok) {
    throw await refusalOf(response)
  }
  return response
}

/** A text answer (an automation's HTML report), capped so one document cannot fill memory. */
export async function buildWebTextRequest(
  request: Omit<BuildWebRequest, 'method' | 'body' | 'responseLimit'> & { maxBytes: number }
): Promise<string> {
  let response: Response
  try {
    response = await getMainHttpClient().fetch(`${request.baseUrl}${request.path}`, {
      headers: { authorization: `Bearer ${request.token}`, accept: 'text/html' },
      redirect: 'error',
      signal: requestSignal(request)
    })
  } catch (error) {
    throw new BuildWebUnreachableError(request.baseUrl, error, request.token)
  }
  if (!response.ok) {
    throw await refusalOf(response)
  }
  const bytes = await readFetchResponseBytesWithinLimit(response, request.maxBytes).catch(
    (error: unknown) => {
      throw error instanceof FetchResponseBodyTooLargeError
        ? new BuildWebApiError('the answer is too large', 413)
        : new BuildWebUnreachableError(request.baseUrl, error, request.token)
    }
  )
  return new TextDecoder().decode(bytes)
}

/**
 * A binary answer (a guide screenshot, a task's file), capped so one cannot fill memory or an RPC
 * frame. Only an image unless `anyType`: a screenshot that turns out to be a page is an error.
 */
export async function buildWebBinaryRequest(
  request: Omit<BuildWebRequest, 'method' | 'body'> & { maxBytes: number; anyType?: boolean }
): Promise<{ mime: string; bytes: Uint8Array }> {
  let response: Response
  try {
    response = await getMainHttpClient().fetch(`${request.baseUrl}${request.path}`, {
      headers: { authorization: `Bearer ${request.token}` },
      redirect: 'error',
      signal: requestSignal(request)
    })
  } catch (error) {
    throw new BuildWebUnreachableError(request.baseUrl, error, request.token)
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {})
    throw new BuildWebApiError(response.statusText || `HTTP ${response.status}`, response.status)
  }
  const mime = response.headers.get('content-type') ?? 'application/octet-stream'
  if (!request.anyType && !mime.startsWith('image/')) {
    await response.body?.cancel().catch(() => {})
    throw new BuildWebApiError('not an image', 415)
  }
  const bytes = await readFetchResponseBytesWithinLimit(response, request.maxBytes).catch(() => {
    throw new BuildWebApiError(request.anyType ? 'file too large' : 'image too large', 413)
  })
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

/** Run a write and report a refusal as a value, so the UI can show it next to the control. */
export async function buildWebMutation<T>(
  run: () => Promise<T>
): Promise<BuildWebMutationResult<T>> {
  try {
    return { ok: true, value: await run() }
  } catch (error) {
    return {
      ok: false,
      error: describeBuildWebError(error),
      ...(error instanceof BuildWebApiError
        ? { status: error.status, ...(error.routeMissing ? { routeMissing: true } : {}) }
        : {})
    }
  }
}
