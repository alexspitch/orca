import { describe, expect, it } from 'vitest'
import {
  distRulesOf,
  PRODUCTS_RHEL_ONLY_FEATURE,
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

  it('builds the monorepo as rhel only on a console that says so, and both on an older one', () => {
    const after = distRulesOf([PRODUCTS_RHEL_ONLY_FEATURE])
    expect(after.distsOf('products')).toEqual(['rhel'])
    expect(after.choosesDist('products')).toBe(false)
    expect(after.trainDistOf('products', 'both')).toBe('rhel')
    expect(after.distsOf('chat-platform')).toEqual(['rhel', 'redos'])
    expect(after.trainDistOf('chat-platform', 'redos')).toBe('redos')
    const before = distRulesOf([])
    expect(before.distOf('products')).toBe('both')
    expect(before.choosesDist('products')).toBe(true)
    expect(before.trainDistOf('products', 'both')).toBe('both')
  })
})
