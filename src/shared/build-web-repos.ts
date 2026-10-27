// The repositories build-web builds from (IS-190): the monorepo, and chat-platform for product `cp`.

export type BuildWebRepo = 'products' | 'chat-platform'

/** The console's own rule: an image is chat-platform's by its `chatplatform/` name. */
export function repoOfImage(image: string): BuildWebRepo {
  return image.startsWith('chatplatform/') ? 'chat-platform' : 'products'
}

/** Every product but `cp` lives in the monorepo. */
export function repoOfProduct(product: string): BuildWebRepo {
  return product === 'cp' ? 'chat-platform' : 'products'
}

/** The field a request names the repository by; nothing for the monorepo, so its requests stay as they were. */
export function repoField(repo: BuildWebRepo): { repo?: 'chat-platform' } {
  return repo === 'chat-platform' ? { repo } : {}
}

// IS-230: the monorepo builds rhel only — the console derives its redos images when they are
// published. chat-platform keeps its own choice, both by default.

export type BuildWebDist = 'rhel' | 'redos'

/** The distribution a new run of this repository asks for. */
export const distOf = (repo: BuildWebRepo): 'rhel' | 'both' =>
  repo === 'products' ? 'rhel' : 'both'

/** Whether a build of this repository offers a choice of distribution. */
export const choosesDist = (repo: BuildWebRepo): boolean => repo !== 'products'

/** The distributions a build of this repository makes, one combo each. */
export const distsOf = (repo: BuildWebRepo): BuildWebDist[] =>
  distOf(repo) === 'rhel' ? ['rhel'] : ['rhel', 'redos']

/** What a run or a train of this repository builds: an older monorepo one still stores `both`. */
export const builtDistOf = (repo: BuildWebRepo, dist: string): string =>
  repo === 'products' ? 'rhel' : dist
