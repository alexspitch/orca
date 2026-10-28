import { z } from 'zod'

// The checked shape of a client's build-web task link (IS-147), for `worktree.create` and
// `worktree.set` over RPC and for the desktop's create IPC.

const TASK_KEY_RE = /^[A-Z][A-Z0-9]*-\d+(?:\.\d+)?$/

/** What a client asks for; the host adds the branch and, later, the console session. */
export const WorktreeBuildWebTaskRequestSchema = z.object({
  issueId: z.string().trim().min(1).max(128),
  key: z.string().regex(TASK_KEY_RE),
  consoleHost: z.string().trim().min(1).max(2048)
})
