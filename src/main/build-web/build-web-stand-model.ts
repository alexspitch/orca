import type {
  BuildWebStandAccount,
  BuildWebStandCard,
  BuildWebStandGroup,
  BuildWebStandLock,
  BuildWebStandService,
  BuildWebStandStatus
} from '../../shared/build-web-stand-types'
import { recordOf, recordsOf, textOf, textOrNull, textsOf } from './build-web-response-fields'

// build-web's answers about stands, narrowed; and the cards grouped into the stands people mean.

const PASSWORDS: readonly BuildWebStandAccount['password'][] = ['set', 'missing', 'broken']
// Why: the page is about the products' own stands; storage and tools cards are left out.
const STAND_PAGE_PRODUCTS: ReadonlySet<string> = new Set(['ap', 'dc', 'sa', 'cp'])

function lockOf(value: unknown): BuildWebStandLock | null {
  const lock = recordOf(value)
  const heldBy = textOf(lock?.held_by)
  return heldBy ? { heldBy, since: textOrNull(lock?.since) } : null
}

export function standCardOf(value: Record<string, unknown>): BuildWebStandCard | null {
  if (typeof value.id !== 'string' || !value.id) {
    return null
  }
  return {
    id: value.id,
    name: textOf(value.name) || value.id,
    sshHost: textOf(value.ssh_host),
    dir: textOf(value.dir),
    branch: textOf(value.branch) || null,
    product: textOf(value.product) || null,
    products: textsOf(value.products),
    uiUrl: textOf(value.ui_url) || null,
    enabled: value.enabled !== false,
    lock: lockOf(value.lock)
  }
}

/** Shared head of the names, cut back to a word boundary; '' when there is none worth showing. */
function commonName(names: string[]): string {
  let head = names[0] ?? ''
  for (const name of names.slice(1)) {
    let i = 0
    while (i < head.length && i < name.length && head[i] === name[i]) {
      i++
    }
    head = head.slice(0, i)
  }
  const trimmed = head.replace(/[\s\-_\u00b7:/|,(]+$/u, '')
  return trimmed.length >= 3 ? trimmed : ''
}

function groupName(cards: BuildWebStandCard[]): string {
  if (cards.length === 1) {
    return cards[0].name
  }
  const names = cards.map((c) => c.name)
  return commonName(names) || names.join(' · ')
}

/**
 * One stand per host, directory and branch: the cards over it are products of one machine. Only
 * the AP, DC, SA and Chat Platform cards count.
 */
export function standGroupsOf(cards: BuildWebStandCard[]): BuildWebStandGroup[] {
  const byKey = new Map<string, BuildWebStandCard[]>()
  for (const card of cards) {
    if (!card.product || !STAND_PAGE_PRODUCTS.has(card.product)) {
      continue
    }
    const key = JSON.stringify([card.sshHost, card.dir, card.branch ?? ''])
    byKey.set(key, [...(byKey.get(key) ?? []), card])
  }
  const groups = [...byKey].map(([key, members]): BuildWebStandGroup => {
    const first = members[0]
    const enabledCard = members.find((c) => c.enabled) ?? null
    return {
      key,
      name: groupName(members),
      sshHost: first.sshHost,
      dir: first.dir,
      branch: first.branch,
      cards: members,
      enabled: enabledCard !== null,
      lock: members.map((c) => c.lock).find((l) => l !== null) ?? null,
      statusCardId: (enabledCard ?? first).id,
      opsCardId: enabledCard?.id ?? null
    }
  })
  return groups.sort(
    (a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name)
  )
}

export function standServiceOf(value: Record<string, unknown>): BuildWebStandService | null {
  const service = textOf(value.service)
  if (!service) {
    return null
  }
  return {
    service,
    image: textOf(value.image),
    runningImage: textOrNull(value.running_image),
    state: textOf(value.state) || 'absent',
    health: textOf(value.health),
    status: textOf(value.status),
    container: textOrNull(value.container),
    build: textOf(value.build) || null,
    imageCreatedAt: textOf(value.image_created) || null,
    startedAt: textOf(value.started_at) || null
  }
}

export function standStatusOf(answer: unknown): BuildWebStandStatus {
  const record = recordOf(answer)
  return {
    services: recordsOf(record?.services)
      .map(standServiceOf)
      .filter((s): s is BuildWebStandService => s !== null),
    detailsError: textOrNull(record?.details_error)
  }
}

export function standAccountOf(value: Record<string, unknown>): BuildWebStandAccount | null {
  if (typeof value.id !== 'string' || !value.id || typeof value.stand_id !== 'string') {
    return null
  }
  return {
    id: value.id,
    description: textOf(value.description),
    email: textOf(value.email),
    standId: value.stand_id,
    role: textOf(value.role_key),
    projectName: textOf(value.project_name),
    password: PASSWORDS.find((p) => p === value.password) ?? 'missing'
  }
}
