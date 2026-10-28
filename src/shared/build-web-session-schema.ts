import { z } from 'zod'

// The checked shapes of a worktree's build-web task (IS-147), for `worktree.create` and
// `worktree.set` over RPC and for the desktop's create IPC.

const TASK_KEY_RE = /^[A-Z][A-Z0-9]*-\d+(?:\.\d+)?$/

/** What a create asks for; the host adds the branch it made for the worktree. */
export const WorktreeBuildWebTaskRequestSchema = z.object({
  issueId: z.string().trim().min(1).max(128),
  key: z.string().regex(TASK_KEY_RE),
  consoleHost: z.string().trim().min(1).max(2048)
})

export const WorktreeBuildWebTaskSchema = WorktreeBuildWebTaskRequestSchema.extend({
  branch: z.string().trim().min(1).max(1024),
  sessionId: z.string().trim().min(1).max(128).optional()
})
