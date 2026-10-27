import { describe, expect, it } from 'vitest'
import {
  builtDistOf,
  choosesDist,
  distOf,
  distsOf,
  repoField,
  repoOfImage,
  repoOfProduct
} from './build-web-repos'

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

  it('builds the monorepo as rhel only and lets chat-platform choose, as the console does', () => {
    expect(distOf('products')).toBe('rhel')
    expect(distsOf('products')).toEqual(['rhel'])
    expect(choosesDist('products')).toBe(false)
    expect(distOf('chat-platform')).toBe('both')
    expect(distsOf('chat-platform')).toEqual(['rhel', 'redos'])
    expect(choosesDist('chat-platform')).toBe(true)
  })

  it('reads an older monorepo run or train stored as both as rhel, chat-platform’s as stored', () => {
    expect(builtDistOf('products', 'both')).toBe('rhel')
    expect(builtDistOf('chat-platform', 'both')).toBe('both')
    expect(builtDistOf('chat-platform', 'redos')).toBe('redos')
  })
})
