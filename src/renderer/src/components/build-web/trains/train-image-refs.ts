// How the run dialog names an image and its tags, after build-web's train-window.ts.

/** `ns/name (dist)`, the journal's build target, split for the image table. */
export function splitTarget(target: string): { name: string; namespace: string; dist: string } {
  const m = /^(.*) \(([^()]+)\)$/.exec(target)
  const image = m ? m[1] : target
  const slash = image.lastIndexOf('/')
  return {
    name: image.slice(slash + 1),
    namespace: slash === -1 ? '' : image.slice(0, slash),
    dist: m ? m[2] : ''
  }
}

/** Full image refs grouped by registry, each kept as its tag; groups in the order first seen. */
export function tagGroups(refs: string[]): { registry: string; tags: string[] }[] {
  const groups = new Map<string, string[]>()
  for (const ref of refs) {
    const colon = ref.lastIndexOf(':')
    // A colon before the last slash is a registry port, not a tag.
    const hasTag = colon > ref.lastIndexOf('/')
    const repo = hasTag ? ref.slice(0, colon) : ref
    const first = repo.indexOf('/')
    // Only a host (a dot, a port or localhost) is a registry; `ns/name` alone has none.
    const host = first > 0 ? repo.slice(0, first) : ''
    const registry = /[.:]|^localhost$/.test(host) ? host : ''
    const list = groups.get(registry) ?? []
    list.push(hasTag ? ref.slice(colon + 1) : 'latest')
    groups.set(registry, list)
  }
  return [...groups].map(([registry, tags]) => ({ registry, tags }))
}
