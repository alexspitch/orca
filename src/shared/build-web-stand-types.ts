// The «Stands» page: build-web's test environments, the services each runs, and the UI logins on it.

export type BuildWebStandLock = { heldBy: string; since: string | null }

/** One card of build-web's stands directory — a product's view of a machine. */
export type BuildWebStandCard = {
  id: string
  name: string
  sshHost: string
  dir: string
  branch: string | null
  product: string | null
  products: string[]
  uiUrl: string | null
  enabled: boolean
  lock: BuildWebStandLock | null
}

/** A stand as people mean it: the cards over one host, directory and branch. */
export type BuildWebStandGroup = {
  key: string
  name: string
  sshHost: string
  dir: string
  branch: string | null
  cards: BuildWebStandCard[]
  enabled: boolean
  lock: BuildWebStandLock | null
  /** Any card reads the compose project: they all share the directory. */
  statusCardId: string
  /** The enabled card operations go through; null when every card is disabled. */
  opsCardId: string | null
}

export type BuildWebStandService = {
  service: string
  /** What the compose files name. */
  image: string
  /** What the container was started from; null when nothing runs for the service. */
  runningImage: string | null
  /** `running`, `exited`, … or `absent` when the service has no container. */
  state: string
  health: string
  /** Docker's own line, `Up 2 hours (healthy)`; '' from an older console. */
  status: string
  container: string | null
  /** The immutable `<ver>b<N>` tag the container runs; null when unknown. */
  build: string | null
  startedAt: string | null
}

export type BuildWebStandStatus = {
  services: BuildWebStandService[]
  /** Why the build numbers are missing while the rest is there. */
  detailsError: string | null
}

export type BuildWebStandAccount = {
  id: string
  description: string
  email: string
  /** The card the account is a login on; its UI address is that card's. */
  standId: string
  role: string
  projectName: string
  password: 'set' | 'missing' | 'broken'
}

/** Where the login tab opens; the password stays with the host that fills the form. */
export type BuildWebStandLoginTarget = {
  profileId: string
  partition: string
  url: string
  title: string
}

/** A piece of a streamed log; `trimmed` when text before `offset` was dropped to bound memory. */
export type BuildWebLogPiece = {
  text: string
  next: number
  done: boolean
  error: string | null
  trimmed: boolean
}

export const BUILD_WEB_STAND_LOG_TAILS = [2000, 10_000, 50_000] as const
export type BuildWebStandLogTail = (typeof BUILD_WEB_STAND_LOG_TAILS)[number]

export const BUILD_WEB_STAND_OP_KINDS = ['up', 'restart'] as const
export type BuildWebStandOpKind = (typeof BUILD_WEB_STAND_OP_KINDS)[number]
