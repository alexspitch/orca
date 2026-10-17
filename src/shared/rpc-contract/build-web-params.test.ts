import { describe, expect, it } from 'vitest'
import { BuildWebFavoriteParams, BuildWebGuideShotParams } from './build-web-params'

describe('build-web params', () => {
  it('refuses ids that URL resolution would turn into another endpoint', () => {
    expect(BuildWebFavoriteParams.safeParse({ id: '..', on: true }).success).toBe(false)
    expect(BuildWebFavoriteParams.safeParse({ id: '.', on: true }).success).toBe(false)
    expect(BuildWebFavoriteParams.safeParse({ id: 'a1b2', on: true }).success).toBe(true)
    expect(BuildWebGuideShotParams.safeParse({ runId: 'r1', slug: '..' }).success).toBe(false)
    expect(BuildWebGuideShotParams.safeParse({ runId: 'r1', slug: 'login-1' }).success).toBe(true)
  })
})
