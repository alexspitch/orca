// Narrowing of build-web JSON: every field the console sends is checked, never cast,
// so a changed or hand-edited answer cannot put a non-string into a header or a view.

export function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null
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
