import { describe, expect, it } from 'vitest'
import {
  NO_RECAP_FILTERS,
  dayStartIso,
  hasRecapFilters,
  recapAutomationOptions,
  recapQuery,
  recapVersionOptions,
  withRecapProduct,
  withRecapVersion
} from './recap-filters'

const VERSIONS = [
  { id: 'sa-216', product: 'sa' as const, name: '2.16' },
  { id: 'sa-215', product: 'sa' as const, name: '2.15' },
  { id: 'dc-31', product: 'dc' as const, name: '3.1' }
]
const AUTOMATIONS = [
  { id: 'a-dc', name: 'DC changes', product: 'dc' as const, version_id: 'dc-31' },
  { id: 'a-sa', name: 'SA sizes', product: 'sa' as const, version_id: 'sa-216' }
]
const FACETS = {
  products: ['sa' as const, 'dc' as const],
  versions: VERSIONS,
  automations: AUTOMATIONS
}

describe('the Recaps query', () => {
  it('asks for everything when nothing is picked', () => {
    expect(recapQuery(NO_RECAP_FILTERS, 0, 50)).toEqual({
      product: null,
      versionId: null,
      automationId: null,
      from: null,
      to: null,
      limit: 50,
      offset: 0
    })
    expect(hasRecapFilters(NO_RECAP_FILTERS)).toBe(false)
  })

  it('takes the whole closing day, in local time, and the page as an offset', () => {
    const q = recapQuery(
      {
        product: 'dc',
        versionId: 'dc-31',
        automationId: 'a-dc',
        from: '2026-10-01',
        to: '2026-10-18'
      },
      2,
      50
    )
    expect(q).toMatchObject({
      product: 'dc',
      versionId: 'dc-31',
      automationId: 'a-dc',
      limit: 50,
      offset: 100
    })
    expect(q.from).toBe(new Date(2026, 9, 1).toISOString())
    expect(q.to).toBe(new Date(2026, 9, 19).toISOString())
  })

  it('reads a day that is not one as no bound', () => {
    expect(dayStartIso('')).toBeNull()
    expect(dayStartIso('2026-1-5')).toBeNull()
    expect(dayStartIso('2026-12-31', 1)).toBe(new Date(2027, 0, 1).toISOString())
  })
})

describe('the version picker', () => {
  it('names each version with its product until a product is picked', () => {
    expect(recapVersionOptions(VERSIONS, 'all')).toEqual([
      { value: 'sa-216', label: 'SA 2.16' },
      { value: 'sa-215', label: 'SA 2.15' },
      { value: 'dc-31', label: 'DC 3.1' }
    ])
    expect(recapVersionOptions(VERSIONS, 'dc')).toEqual([{ value: 'dc-31', label: '3.1' }])
  })

  it('drops a version that is not the new product’s, and keeps one that is', () => {
    const picked = { ...NO_RECAP_FILTERS, versionId: 'sa-216' }
    expect(withRecapProduct(picked, 'dc', FACETS).versionId).toBe('all')
    expect(withRecapProduct(picked, 'sa', FACETS).versionId).toBe('sa-216')
    expect(withRecapProduct(picked, 'all', FACETS)).toEqual({ ...picked, product: 'all' })
  })
})

describe('the automation picker', () => {
  it('offers the automations of the picked product and version', () => {
    expect(recapAutomationOptions(AUTOMATIONS, NO_RECAP_FILTERS).map((a) => a.id)).toEqual([
      'a-dc',
      'a-sa'
    ])
    const dc = { ...NO_RECAP_FILTERS, product: 'dc' as const }
    expect(recapAutomationOptions(AUTOMATIONS, dc).map((a) => a.id)).toEqual(['a-dc'])
    const old = { ...NO_RECAP_FILTERS, versionId: 'sa-215' }
    expect(recapAutomationOptions(AUTOMATIONS, old)).toEqual([])
  })

  it('drops a picked automation another product or version leaves out', () => {
    const picked = { ...NO_RECAP_FILTERS, automationId: 'a-sa' }
    expect(withRecapProduct(picked, 'dc', FACETS).automationId).toBe('all')
    expect(withRecapProduct(picked, 'sa', FACETS).automationId).toBe('a-sa')
    expect(withRecapVersion(picked, 'sa-215', FACETS).automationId).toBe('all')
    expect(withRecapVersion(picked, 'sa-216', FACETS).automationId).toBe('a-sa')
    expect(hasRecapFilters(picked)).toBe(true)
  })

  it('keeps nothing against a console without the automation list', () => {
    const picked = { ...NO_RECAP_FILTERS, automationId: 'a-sa' }
    expect(withRecapProduct(picked, 'sa', { ...FACETS, automations: null }).automationId).toBe(
      'all'
    )
  })
})
