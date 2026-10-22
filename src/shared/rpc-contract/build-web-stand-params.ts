import { z } from 'zod'
import { BUILD_WEB_STAND_LOG_TAILS, BUILD_WEB_STAND_OP_KINDS } from '../build-web-stand-types'

// The «Stands» page's calls. Same rules as build-web-params: one object per call, and an id never
// becomes `.` or `..` inside a URL path.

const notDotSegment = (value: string) => value !== '.' && value !== '..'
const Id = z.string().trim().min(1, 'Missing id').max(128).refine(notDotSegment, 'Invalid id')
// Why: compose's own service-name shape; the name reaches the console's URL and a remote shell.
const ServiceName = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/, 'Not a service name')
const LogTail = z.literal(BUILD_WEB_STAND_LOG_TAILS)

// Why a group key, not a card id: a stand is the cards over one host, directory and branch.
const StandKey = z.string().min(1).max(1024)
export const BuildWebStandHealthParams = z
  .object({
    refresh: z.boolean().optional(),
    /** Stands the viewer hid; the host does not read them. */
    hidden: z.array(StandKey).max(500).optional()
  })
  .optional()
export const BuildWebStandIdsParams = z.object({ standIds: z.array(Id).min(1).max(20) })
export const BuildWebStandOpParams = z.object({
  standId: Id,
  kind: z.enum(BUILD_WEB_STAND_OP_KINDS),
  services: z.array(ServiceName).max(50).optional()
})
export const BuildWebStandLogsStartParams = z.object({
  standId: Id,
  service: ServiceName,
  tail: LogTail,
  follow: z.boolean()
})
export const BuildWebStandLogsReadParams = z.object({
  streamId: z.uuid(),
  offset: z.number().int().min(0)
})
export const BuildWebStandLogsStopParams = z.object({ streamId: z.uuid() })
export const BuildWebStandLoginParams = z.object({ accountId: Id, browserPageId: z.uuid() })
