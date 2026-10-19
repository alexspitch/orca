import type {
  CodeDefinitionResult,
  CodeNavigationDocument,
  CodeNavigationEngine,
  CodeOutlineSymbol,
  CodePosition
} from './code-navigation-types'

type RegisteredEngine = { engine: CodeNavigationEngine; priority: number; order: number }

const engines: RegisteredEngine[] = []
const availabilityListeners = new Set<() => void>()
let registrationOrder = 0

/** Higher priority answers first; built-ins use 0 so host language servers can sit above them. */
export function registerCodeNavigationEngine(
  engine: CodeNavigationEngine,
  priority = 0
): () => void {
  const entry = { engine, priority, order: registrationOrder++ }
  engines.push(entry)
  engines.sort((a, b) => b.priority - a.priority || a.order - b.order)
  notifyCodeNavigationAvailabilityChanged()
  return () => {
    const index = engines.indexOf(entry)
    if (index !== -1) {
      engines.splice(index, 1)
      notifyCodeNavigationAvailabilityChanged()
    }
  }
}

/** Lets open outlines re-ask when an engine becomes able to answer (e.g. a server got ready). */
export function onDidChangeCodeNavigationAvailability(listener: () => void): () => void {
  availabilityListeners.add(listener)
  return () => availabilityListeners.delete(listener)
}

export function notifyCodeNavigationAvailabilityChanged(): void {
  for (const listener of availabilityListeners) {
    listener()
  }
}

function enginesFor(doc: CodeNavigationDocument): CodeNavigationEngine[] {
  return engines.filter(({ engine }) => engine.supports(doc.languageId)).map((e) => e.engine)
}

export async function getCodeOutline(
  doc: CodeNavigationDocument,
  signal: AbortSignal
): Promise<CodeOutlineSymbol[]> {
  for (const engine of enginesFor(doc)) {
    const result = await runEngineStep(() => engine.getOutline(doc, signal), engine.id, signal)
    if (result) {
      return result
    }
  }
  return []
}

export async function getCodeDefinitions(
  doc: CodeNavigationDocument,
  position: CodePosition,
  signal: AbortSignal
): Promise<CodeDefinitionResult[]> {
  for (const engine of enginesFor(doc)) {
    const result = await runEngineStep(
      () => engine.getDefinitions(doc, position, signal),
      engine.id,
      signal
    )
    if (result) {
      return result
    }
  }
  return []
}

async function runEngineStep<T>(
  step: () => Promise<T | null>,
  engineId: string,
  signal: AbortSignal
): Promise<T | null> {
  try {
    return await step()
  } catch (error) {
    if (signal.aborted) {
      throw error
    }
    // Why: one engine failing (host down, parser bug) must fall through to the next, not break navigation.
    console.warn(`[code-navigation] ${engineId} failed`, error)
    return null
  }
}
