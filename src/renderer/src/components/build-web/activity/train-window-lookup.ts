import type { BuildWebTrain, BuildWebTrainRun } from '../../../../../shared/build-web-train-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'

// Which train window a notification is about. The console's train row names neither the train's
// id nor the window, and an image build names only its run — so both are found among recent windows.

// Why a bound: a notification older than this many windows is past the bell's own 30 days anyway.
const WINDOWS_READ = 50

export type TrainWindow = {
  train: BuildWebTrain
  run: BuildWebTrainRun | null
}

function recentWindows(target: RuntimeClientTarget, trainId: string): Promise<BuildWebTrainRun[]> {
  // Why every window: a window that failed while scanning holds no actions, and would be left out.
  return callBuildWeb(target, 'trainRuns', {
    trainId,
    limit: WINDOWS_READ,
    offset: 0,
    withActions: false
  }).then((answer) => answer.runs)
}

/** The failed window that ended nearest `at`; the newest window when none failed. */
export function failedWindowNear(
  runs: readonly BuildWebTrainRun[],
  at: string
): BuildWebTrainRun | null {
  const when = Date.parse(at)
  const failed = runs.filter((r) => r.status === 'failed')
  if (failed.length === 0 || Number.isNaN(when)) {
    return failed[0] ?? runs[0] ?? null
  }
  const distance = (r: BuildWebTrainRun) => Math.abs(Date.parse(r.updated_at) - when)
  return failed.reduce((best, r) => (distance(r) < distance(best) ? r : best))
}

/** A train by its name, with the window that failed at `at`; null when no train has that name. */
export async function findFailedTrainWindow(
  target: RuntimeClientTarget,
  trainName: string,
  at: string
): Promise<TrainWindow | null> {
  const trains = await callBuildWeb(target, 'listTrains')
  const train = trains.find((t) => t.name === trainName)
  if (!train) {
    return null
  }
  return {
    train,
    run: failedWindowNear(await recentWindows(target, train.id), at)
  }
}

/** The train window whose images a build run holds; null for a run no train made. */
export async function findRunTrainWindow(
  target: RuntimeClientTarget,
  buildRunId: string
): Promise<TrainWindow | null> {
  const trains = await callBuildWeb(target, 'listTrains')
  const found = await Promise.all(
    trains.map(async (train) => {
      const runs = await recentWindows(target, train.id).catch(() => [])
      const run = runs.find((r) => r.build_run_id === buildRunId)
      return run ? { train, run } : null
    })
  )
  return found.find((w) => w !== null) ?? null
}
