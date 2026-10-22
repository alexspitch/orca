import { describe, expect, it } from 'vitest'
import { repoField, repoOfImage, repoOfProduct } from './build-web-repos'

describe('build-web repositories', () => {
  it('finds chat-platform by the image name and by product cp, the monorepo otherwise', () => {
    expect(repoOfImage('chatplatform/agent-manager')).toBe('chat-platform')
    expect(repoOfImage('dc/ib-api-server')).toBe('products')
    expect(repoOfProduct('cp')).toBe('chat-platform')
    expect(repoOfProduct('sa')).toBe('products')
  })

  it('names only chat-platform in a request, so a monorepo request stays as it was', () => {
    expect(repoField('chat-platform')).toEqual({ repo: 'chat-platform' })
    expect(repoField('products')).toEqual({})
  })
})
