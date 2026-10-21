import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ProviderRateLimits, RateLimitWindow } from '../../../../shared/rate-limit-types'

vi.mock('@/i18n/i18n', () => ({
  i18n: { language: 'en' },
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    Object.entries(values ?? {}).reduce(
      (result, [key, value]) => result.replace(`{{${key}}}`, value),
      fallback
    )
}))

vi.mock('@/lib/agent-catalog', () => ({
  AgentIcon: () => null
}))

vi.mock('../../store', () => ({
  useAppStore: (selector: (state: { usagePercentageDisplay: 'used' | 'remaining' }) => unknown) =>
    selector({ usagePercentageDisplay: 'used' })
}))

function usageWindow(usedPercent: number, windowMinutes: number): RateLimitWindow {
  return { usedPercent, windowMinutes, resetsAt: null, resetDescription: null }
}

function claude(session: number, weekly: number): ProviderRateLimits {
  return {
    provider: 'claude',
    session: usageWindow(session, 300),
    weekly: usageWindow(weekly, 10080),
    updatedAt: Date.now(),
    error: null,
    status: 'ok'
  }
}

function tones(markup: string): string[] {
  return [...markup.matchAll(/data-usage-tone="([a-z]+)"/g)].map((match) => match[1])
}

describe('ProviderSegment limit colors', () => {
  it('colors each window by how much of it is used, at the usage bar thresholds', async () => {
    const { ProviderSegment } = await import('./StatusBar')
    expect(
      tones(
        renderToStaticMarkup(<ProviderSegment p={claude(59, 60)} compact={false} display="used" />)
      )
    ).toEqual(['normal', 'warning'])
    expect(
      tones(
        renderToStaticMarkup(<ProviderSegment p={claude(79, 80)} compact={false} display="used" />)
      )
    ).toEqual(['warning', 'urgent'])
  })

  it('keeps the color when the bar shows what is left', async () => {
    const { ProviderSegment } = await import('./StatusBar')
    const markup = renderToStaticMarkup(
      <ProviderSegment p={claude(90, 10)} compact={false} display="remaining" />
    )
    expect(tones(markup)).toEqual(['urgent', 'normal'])
    // 90% used shows as 10% left, and still reads urgent.
    expect(markup).toMatch(/data-usage-tone="urgent"[^>]*>10% /)
  })
})
