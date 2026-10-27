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

// IS-230: a console that announces `products-rhel-only` builds the monorepo as rhel only and derives
// its redos images when they are published; chat-platform keeps its own choice, both by default. An
// older console — or one whose features are not known yet — builds both as before.

export type BuildWebDist = 'rhel' | 'redos'

/** The feature `/api/me` names for a console after IS-230. */
export const PRODUCTS_RHEL_ONLY_FEATURE = 'products-rhel-only'

/** The distributions a choice stands for: `both` is one combo each. */
export const distsOfChoice = (dist: string): string[] =>
  dist === 'both' ? ['rhel', 'redos'] : [dist]

export type DistRules = {
  productsRhelOnly: boolean
  /** The distribution a new run of this repository asks for. */
  distOf: (repo: BuildWebRepo) => 'rhel' | 'both'
  /** Whether a build of this repository offers a choice of distribution. */
  choosesDist: (repo: BuildWebRepo) => boolean
  /** The distributions a build of this repository makes, one combo each. */
  distsOf: (repo: BuildWebRepo) => BuildWebDist[]
  /** What a train builds, as the console's `trainDists`: a monorepo one stores `both` from before. */
  trainDistOf: (repo: BuildWebRepo, dist: string) => string
}

export function distRulesOf(features: readonly string[]): DistRules {
  const productsRhelOnly = features.includes(PRODUCTS_RHEL_ONLY_FEATURE)
  const rhelOnly = (repo: BuildWebRepo) => productsRhelOnly && repo === 'products'
  return {
    productsRhelOnly,
    distOf: (repo) => (rhelOnly(repo) ? 'rhel' : 'both'),
    choosesDist: (repo) => !rhelOnly(repo),
    distsOf: (repo) => (rhelOnly(repo) ? ['rhel'] : ['rhel', 'redos']),
    trainDistOf: (repo, dist) => (rhelOnly(repo) ? 'rhel' : dist)
  }
}
