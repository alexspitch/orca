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
