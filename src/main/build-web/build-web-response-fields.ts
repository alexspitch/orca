// Narrowing of build-web JSON: every field the console sends is checked, never cast,
// so a changed or hand-edited answer cannot put a non-string into a header or a view.

export function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null
}

/** The objects of an array answer; anything else in it is dropped. */
export function recordsOf(value: unknown): Record<string, unknown>[] {
  return (Array.isArray(value) ? value : [])
    .map(recordOf)
    .filter((v): v is Record<string, unknown> => v !== null)
}

export function textOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function textOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function numberOf(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function textsOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

/** A Jenkins URL as is; a log the console or an agent keeps (a path) on the console's origin. */
export function consoleUrlOf(url: string | null, baseUrl: string): string | null {
  if (!url) {
    return null
  }
  try {
    const resolved = new URL(url, `${baseUrl}/`)
    return resolved.protocol === 'https:' || resolved.protocol === 'http:' ? resolved.href : null
  } catch {
    return null
  }
}

/** `{ image: [what, …] }` as the console's detect and sync scan name an image's changed sources. */
export function sourcesOf(value: unknown): Record<string, string[]> {
  const v = recordOf(value) ?? {}
  return Object.fromEntries(Object.entries(v).map(([image, why]) => [image, textsOf(why)]))
}
