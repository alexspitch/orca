import type {
  BuildWebRecap,
  BuildWebRecapAutomation,
  BuildWebRecapPage,
  BuildWebRecapQuery,
  BuildWebRecapReportPiece,
  BuildWebRecapVersion
} from '../../shared/build-web-recap-types'
import {
  BUILD_WEB_PRODUCTS,
  type BuildWebMutationResult,
  type BuildWebProduct
} from '../../shared/build-web-types'
import { requireBuildWebCredential, type BuildWebCredential } from './build-web-connection'
import {
  BuildWebApiError,
  buildWebMutation,
  buildWebRequest,
  buildWebTextRequest
} from './build-web-request'
import {
  numberOf,
  recordOf,
  recordsOf,
  textOf,
  textOrNull,
  textsOf
} from './build-web-response-fields'

// build-web's automation reports for Orca's «Recaps» page: the list, and one report in pieces.

// Why: mermaid alone is 3.4 MB inline; the cap only stops a runaway document.
const REPORT_MAX_BYTES = 8 * 1024 * 1024
// Why: a piece escaped six times over as JSON still fits one RPC reply (about 4 MB).
export const RECAP_PIECE_CHARS = 512 * 1024
const KEPT_REPORTS = 4

const productOf = (value: unknown): BuildWebProduct | null =>
  BUILD_WEB_PRODUCTS.find((p) => p === value) ?? null

function recapOf(r: Record<string, unknown>): BuildWebRecap {
  const v = recordOf(r.version)
  return {
    id: textOf(r.id),
    automation_id: textOf(r.automation_id),
    name: textOf(r.name),
    product: productOf(r.product) ?? 'unknown',
    version:
      v && typeof v.id === 'string'
        ? { id: v.id, name: textOf(v.name), branch: textOf(v.branch) }
        : null,
    commit: textOrNull(r.commit),
    trigger: r.trigger === 'scheduled' ? 'scheduled' : 'manual',
    started_by: textOrNull(r.started_by),
    finished_at: textOf(r.finished_at)
  }
}

function versionOf(v: Record<string, unknown>): BuildWebRecapVersion | null {
  const product = productOf(v.product)
  return product && typeof v.id === 'string' ? { id: v.id, product, name: textOf(v.name) } : null
}

function automationOf(a: Record<string, unknown>): BuildWebRecapAutomation | null {
  const product = productOf(a.product)
  return product && typeof a.id === 'string'
    ? { id: a.id, name: textOf(a.name), product, version_id: textOf(a.version_id) }
    : null
}

/** A console without the list says so in its own way; both are worded as "update build-web". */
function olderConsole(error: unknown): BuildWebApiError | null {
  if (!(error instanceof BuildWebApiError)) {
    return null
  }
  // A console with automations but not this list answers from `/automations/:id`.
  if (error.status === 404) {
    return new BuildWebApiError(
      'This build-web has no Recaps list yet. Update the console.',
      404,
      [],
      true
    )
  }
  // One older than automations refuses a route no section owns, naming no permission.
  if (error.status === 403 && error.needsPermission.length === 0) {
    return new BuildWebApiError(
      'This build-web has no automations yet. Update the console.',
      404,
      [],
      true
    )
  }
  return null
}

/** One page of the finished reports, newest first; a refusal comes back as a value. */
export function listBuildWebRecaps(
  query: BuildWebRecapQuery
): Promise<BuildWebMutationResult<BuildWebRecapPage>> {
  return buildWebMutation(async () => {
    const credential = requireBuildWebCredential()
    const params = new URLSearchParams({ limit: String(query.limit), offset: String(query.offset) })
    if (query.product) {
      params.set('product', query.product)
    }
    if (query.versionId) {
      params.set('version', query.versionId)
    }
    if (query.automationId) {
      params.set('automation', query.automationId)
    }
    if (query.from) {
      params.set('from', query.from)
    }
    if (query.to) {
      params.set('to', query.to)
    }
    const answer = recordOf(
      await buildWebRequest({
        ...credential,
        path: `/api/automations/results?${params.toString()}`
      }).catch((error: unknown) => {
        throw olderConsole(error) ?? error
      })
    )
    const facets = recordOf(answer?.facets)
    return {
      results: recordsOf(answer?.results)
        .filter((r) => typeof r.id === 'string')
        .map(recapOf),
      total: numberOf(answer?.total),
      facets: {
        products: textsOf(facets?.products)
          .map(productOf)
          .filter((p): p is BuildWebProduct => p !== null),
        versions: recordsOf(facets?.versions)
          .map(versionOf)
          .filter((v): v is BuildWebRecapVersion => v !== null),
        // Why null when absent: an older console ignores `automation` and would answer unfiltered.
        automations: Array.isArray(facets?.automations)
          ? recordsOf(facets.automations)
              .map(automationOf)
              .filter((a): a is BuildWebRecapAutomation => a !== null)
          : null
      }
    }
  })
}

// Newest last. A finished report never changes, so a piece read later comes from the same text.
const keptReports: { key: string; html: Promise<string> }[] = []

function reportOf(credential: BuildWebCredential, runId: string): Promise<string> {
  const key = `${credential.baseUrl}|${credential.generation}|${runId}`
  const index = keptReports.findIndex((k) => k.key === key)
  if (index !== -1) {
    const [hit] = keptReports.splice(index, 1)
    keptReports.push(hit)
    return hit.html
  }
  const entry = {
    key,
    html: buildWebTextRequest({
      baseUrl: credential.baseUrl,
      token: credential.token,
      path: `/api/automations/runs/${encodeURIComponent(runId)}/report`,
      maxBytes: REPORT_MAX_BYTES
    })
  }
  keptReports.push(entry)
  keptReports.splice(0, Math.max(0, keptReports.length - KEPT_REPORTS))
  // Why: a failed read is asked again next time, not answered from the cache.
  entry.html.catch(() => {
    const at = keptReports.indexOf(entry)
    if (at !== -1) {
      keptReports.splice(at, 1)
    }
  })
  return entry.html
}

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff

/** The report's HTML from `offset`, one piece at a time: a whole report outgrows one RPC reply. */
export async function readBuildWebRecapReport(
  runId: string,
  offset: number
): Promise<BuildWebRecapReportPiece> {
  const html = await reportOf(requireBuildWebCredential(), runId)
  const start = Math.min(offset, html.length)
  let end = Math.min(start + RECAP_PIECE_CHARS, html.length)
  if (end < html.length && isHighSurrogate(html.charCodeAt(end - 1))) {
    end -= 1
  }
  return { text: html.slice(start, end), next: end, total: html.length }
}
