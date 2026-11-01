import type { BuildWebDeployNotesJob } from '../../../../../../shared/build-web-types'

// IS-341: what the Deploy tab makes of the note's last generation — as build-web's IssueDeployNotes.

export const isWritingDeployNotes = (job: BuildWebDeployNotesJob | null | undefined): boolean =>
  job?.status === 'queued' || job?.status === 'running'

/** A generation that failed or was stopped after the note shown was written: that note stays. */
export const failedSinceNote = (
  job: BuildWebDeployNotesJob | null | undefined,
  noteCreatedAt: string
): job is BuildWebDeployNotesJob =>
  (job?.status === 'failed' || job?.status === 'cancelled') && job.created_at >= noteCreatedAt
