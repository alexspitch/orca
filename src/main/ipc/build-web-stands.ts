import { ipcMain } from 'electron'
import type { ZodTypeAny, z } from 'zod'
import {
  BuildWebStandIdsParams,
  BuildWebStandLoginParams,
  BuildWebStandLogsReadParams,
  BuildWebStandLogsStartParams,
  BuildWebStandLogsStopParams,
  BuildWebStandOpParams
} from '../../shared/rpc-contract/build-web-stand-params'
import { BuildWebStandParams } from '../../shared/rpc-contract/build-web-task-params'
import { startBuildWebStandLogin } from '../build-web/build-web-stand-login'
import { RuntimeBuildWebStandCommands } from '../runtime/runtime-build-web-stand-commands'

const commands = new RuntimeBuildWebStandCommands()

// The same schemas as the RPC methods: IPC and a paired client agree on every field.
function handle<S extends ZodTypeAny>(
  channel: string,
  schema: S,
  run: (args: z.infer<S>) => unknown
): void {
  ipcMain.handle(`buildWeb:${channel}`, async (_event, args: unknown) => run(schema.parse(args)))
}

/** The «Stands» page's calls. */
export function registerBuildWebStandHandlers(): void {
  ipcMain.handle('buildWeb:standGroups', () => commands.buildWebStandGroups())
  handle('standStatus', BuildWebStandParams, (args) => commands.buildWebStandStatus(args))
  handle('standAccounts', BuildWebStandIdsParams, (args) => commands.buildWebStandAccounts(args))
  handle('standJobs', BuildWebStandIdsParams, (args) => commands.buildWebStandJobs(args))
  handle('standOp', BuildWebStandOpParams, (args) => commands.buildWebStandOp(args))
  handle('startStandLogs', BuildWebStandLogsStartParams, (args) =>
    commands.buildWebStartStandLogs(args)
  )
  handle('standLogs', BuildWebStandLogsReadParams, (args) => commands.buildWebStandLogs(args))
  handle('stopStandLogs', BuildWebStandLogsStopParams, (args) =>
    commands.buildWebStopStandLogs(args)
  )
  // Why IPC only: it opens a tab of this desktop's browser, which no paired server can drive.
  handle('standLogin', BuildWebStandLoginParams, (args) => startBuildWebStandLogin(args))
}
