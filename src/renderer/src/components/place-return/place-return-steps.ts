import { nextSerial, type Place } from './place-return-arm'

/** What going back closes: only a file or task the step itself opened. */
export type CloseTarget =
  | { kind: 'file'; worktreeId: string; tabId: string; entityId: string }
  | { kind: 'task'; issueId: string }

/** One move from `origin` to `target`; going back closes `close`, if any, and shows `origin`. */
export type Step = { origin: Place; target: Place; close: CloseTarget | null; at: number }

const STEPS_KEPT = 50

let steps: Step[] = []

export function topStep(): Step | undefined {
  return steps.at(-1)
}

/** Newest first, for looking down the history without changing it. */
export function stepsNewestFirst(): readonly Step[] {
  return steps.toReversed()
}

export function pushStep(origin: Place, target: Place, close: CloseTarget | null): void {
  steps = [...steps, { origin, target, close, at: nextSerial() }].slice(-STEPS_KEPT)
}

export function popStep(): Step | undefined {
  const top = steps.at(-1)
  steps = steps.slice(0, -1)
  return top
}

/** The top step ends somewhere else: one move however many places it passed through. */
export function retargetTop(target: Place): void {
  const top = steps.at(-1)
  if (top) {
    steps = [...steps.slice(0, -1), { ...top, target }]
  }
}

/** Drops the steps recorded after `at`: a link's way to its target becomes its one step. */
export function dropStepsAfter(at: number): void {
  steps = steps.filter((step) => step.at <= at)
}

export function clearSteps(): void {
  steps = []
}
