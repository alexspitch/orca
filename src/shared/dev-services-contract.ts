import { z } from 'zod'

export const DEV_SERVICES_VERB_PATTERN = /^[a-z][a-z0-9-]{0,31}$/
export const DEV_SERVICES_MAX_ARGS = 16
export const DEV_SERVICES_MAX_ARG_LENGTH = 256

export const DEV_SERVICES_STATUS_TIMEOUT_MS = 10_000
// Why minutes: this deadline only catches a hung command — a real start or release cut off midway would
// leave the stack half done.
export const DEV_SERVICES_RUN_TIMEOUT_MS = 5 * 60_000
// Why: the client must outwait the host's own deadline, or a slow host reads as a dropped call.
export const DEV_SERVICES_CLIENT_TIMEOUT_MARGIN_MS = 5_000
// Why several runs: actions on one worktree queue on the host, and the wait in that queue counts here.
export const DEV_SERVICES_RUN_CLIENT_TIMEOUT_MS =
  3 * DEV_SERVICES_RUN_TIMEOUT_MS + DEV_SERVICES_CLIENT_TIMEOUT_MARGIN_MS

const MAX_ENTRIES = 500

const DevServicesPortSchema = z.object({
  port: z.number().int(),
  url: z.string().optional(),
  open: z.boolean().optional()
})

// Why `unknown`: a newer repo command may report a state this build cannot draw; it must not read
// as stopped.
const DevServicesServiceStateSchema = z
  .enum(['ready', 'starting', 'stopping', 'crashed', 'stopped', 'absent', 'shared'])
  .or(z.literal('unknown'))
  .catch('unknown')

// Why sliced, not refused: a long list of changed files must not drop the whole status.
const DevServicesNamesSchema = z
  .array(z.string())
  .default([])
  .transform((names) => names.slice(0, MAX_ENTRIES))
  .catch([])

/** Code on disk newer than what the service runs: it needs a restart, some of it a build first. */
const DevServicesChangedSchema = z.object({
  /** Epoch seconds of the oldest change the running service does not have. */
  since: z.number().nullable().optional().catch(undefined),
  files: DevServicesNamesSchema,
  workspaces: DevServicesNamesSchema,
  /** Workspaces whose build output is older than their source: a restart alone runs stale code. */
  unbuilt: DevServicesNamesSchema
})

const DevServicesServiceSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  profile: z.string().nullable().default(null),
  state: DevServicesServiceStateSchema,
  since: z.number().nullable().optional(),
  restarts: z.number().optional(),
  exit: z.number().nullable().optional(),
  detail: z.string().optional(),
  ports: z.array(DevServicesPortSchema).max(MAX_ENTRIES).default([]),
  console: z.string().optional(),
  // Why `catch`: a shape this build does not know drops the badge, not the service.
  changed: DevServicesChangedSchema.optional().catch(undefined)
})

const DevServicesProfileSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  includes: z.array(z.string()).max(MAX_ENTRIES).default([]),
  services: z.array(z.string()).max(MAX_ENTRIES).default([]),
  ready: z.number().default(0),
  running: z.number().default(0),
  total: z.number().default(0)
})

const DevServicesVerbSchema = z.string().regex(DEV_SERVICES_VERB_PATTERN)
const DevServicesArgsSchema = z
  .array(z.string().max(DEV_SERVICES_MAX_ARG_LENGTH))
  .max(DEV_SERVICES_MAX_ARGS)
  .default([])

const DevServicesActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().optional(),
  tone: z.enum(['normal', 'warning']).catch('normal'),
  verb: DevServicesVerbSchema,
  args: DevServicesArgsSchema
})

const DevServicesProblemSchema = z.object({
  message: z.string().min(1),
  action: z
    .object({ label: z.string().min(1), verb: DevServicesVerbSchema, args: DevServicesArgsSchema })
    .optional()
})

const DevServicesErrorSchema = z.object({ code: z.string(), message: z.string() })

export const DevServicesStatusSchema = z.object({
  api: z.number(),
  ok: z.boolean(),
  error: DevServicesErrorSchema.optional(),
  supported: z.boolean().optional(),
  worktree: z
    .object({ path: z.string(), slot: z.number().nullable(), label: z.string() })
    .optional(),
  profiles: z.array(DevServicesProfileSchema).max(MAX_ENTRIES).default([]),
  services: z.array(DevServicesServiceSchema).max(MAX_ENTRIES).default([]),
  actions: z.array(DevServicesActionSchema).max(MAX_ENTRIES).default([]),
  others: z
    .array(
      z.object({
        path: z.string(),
        name: z.string(),
        slot: z.number().nullable(),
        running: z.number()
      })
    )
    .max(MAX_ENTRIES)
    .default([]),
  problems: z.array(DevServicesProblemSchema).max(MAX_ENTRIES).default([])
})

export const DevServicesRunOutcomeSchema = z.object({
  api: z.number(),
  ok: z.boolean(),
  error: DevServicesErrorSchema.optional(),
  message: z.string().optional(),
  /** With `error.code: 'build'`: each target that did not build, and what the build printed. */
  failed: z
    .array(z.object({ target: z.string(), output: z.string().default('') }))
    .max(MAX_ENTRIES)
    .optional()
    .catch(undefined),
  /** Services a rebuild asked to restart that did not answer in time. */
  pending: z.array(z.string()).max(MAX_ENTRIES).optional().catch(undefined)
})

export type DevServicesStatus = z.infer<typeof DevServicesStatusSchema>
export type DevServicesService = DevServicesStatus['services'][number]
export type DevServicesServiceState = DevServicesService['state']
export type DevServicesProfile = DevServicesStatus['profiles'][number]
export type DevServicesAction = DevServicesStatus['actions'][number]
export type DevServicesProblem = DevServicesStatus['problems'][number]
export type DevServicesRunOutcome = z.infer<typeof DevServicesRunOutcomeSchema>

/** The only contract version this build reads. */
export const DEV_SERVICES_API_VERSION = 1

export type DevServicesUnavailableReason =
  /** Not a git worktree this host runs: a folder workspace, an SSH repo without orcad, … */
  | 'unsupported-workspace'
  /** The repo's orca.yaml names no `services.command`. */
  | 'no-services'
  /** orca.yaml changed since the user trusted the command. */
  | 'command-changed'
  /** The repo runs only local commands (`local-only`), and the services command has no local variant. */
  | 'disabled'

type DevServicesUnavailable = {
  kind: 'unavailable'
  reason: DevServicesUnavailableReason
  message: string
}
/** The command ran but said nothing this build can read. */
type DevServicesFailed = { kind: 'failed'; message: string }
/** No answer within the deadline: services may be in any state. */
type DevServicesUnverifiable = { kind: 'unverifiable'; message: string }

export type DevServicesStatusResponse =
  | DevServicesUnavailable
  | DevServicesFailed
  | DevServicesUnverifiable
  | { kind: 'status'; status: DevServicesStatus }

export type DevServicesRunResponse =
  | DevServicesUnavailable
  | DevServicesFailed
  | DevServicesUnverifiable
  | { kind: 'done'; outcome: DevServicesRunOutcome }
