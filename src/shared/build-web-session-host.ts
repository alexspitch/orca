import { LOCAL_EXECUTION_HOST_ID, parseExecutionHostId } from './execution-host'

// IS-147: a task session's `execution_host_id` names its host as the build-web host (the one holding
// the console's token) names it, since every client of the console reaches that host. A paired
// server's `runtime:` id is minted by each desktop when it pairs, so no other client can resolve it.

type RecordedServer = { id: `runtime:${string}`; environmentId: string }

/** What a client records for a session it starts on `hostId`: the build-web host's own is `local`. */
export function recordedSessionHostId(hostId: string | undefined, onBuildWebHost: boolean): string {
  const host = parseExecutionHostId(hostId)
  if (onBuildWebHost) {
    // Why SSH stays: the build-web host names its own SSH targets the same way.
    return host?.kind === 'ssh' ? host.id : LOCAL_EXECUTION_HOST_ID
  }
  return host?.id ?? LOCAL_EXECUTION_HOST_ID
}

/**
 * The paired server a recorded session ran on, when this client knows it. Null means the build-web
 * host: `local`, empty (older records), SSH, or a server id another client minted.
 */
export function recordedSessionServer(
  recorded: string | null | undefined,
  knows: (server: RecordedServer) => boolean
): RecordedServer | null {
  const host = parseExecutionHostId(recorded)
  return host?.kind === 'runtime' && knows(host) ? host : null
}
