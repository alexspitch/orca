import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '../../i18n/i18n'
import type { ServerLoadResult } from './server-load'

const readings = vi.hoisted(() => {
  const value: Record<string, ServerLoadResult> = {}
  return { value }
})
vi.mock('./use-server-load', () => ({ useServerLoad: () => readings.value }))

import { TooltipProvider } from '@/components/ui/tooltip'
import { ServerLoadStatusSegment } from './ServerLoadStatusSegment'

function load(cpuPercent: number, memoryPercent: number): ServerLoadResult {
  return {
    status: 'sampled',
    load: {
      cpuPercent,
      cpuSource: 'busy',
      loadAverage1m: 1,
      cpuCoreCount: 8,
      memoryPercent,
      usedMemory: 1,
      totalMemory: 2
    }
  }
}

function render(iconOnly = false): string {
  return renderToStaticMarkup(
    React.createElement(
      TooltipProvider,
      null,
      React.createElement(ServerLoadStatusSegment, {
        hosts: [
          { id: 'dev', label: 'dev' },
          { id: 'swiss', label: 'swiss' },
          { id: 'down', label: 'down' }
        ],
        compact: false,
        iconOnly
      })
    )
  )
}

const bullets = (markup: string): string[] =>
  [...markup.matchAll(/rounded-full ([a-z-]+(?:\/\d+)?)"/g)].map(([, color]) => color)

describe('ServerLoadStatusSegment', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    readings.value = {
      dev: load(12.4, 45),
      swiss: load(35, 94),
      down: { status: 'unreachable' }
    }
  })

  it("names each server with its CPU and memory, and reddens a busy one's bullet", () => {
    const markup = render()
    expect(bullets(markup)).toEqual([
      'bg-status-success',
      'bg-destructive',
      'bg-muted-foreground/40'
    ])
    expect(markup).toContain('aria-label="dev: CPU 12%, memory 45%"')
    expect(markup).toContain('aria-label="swiss: CPU 35%, memory 94%"')
    expect(markup).toContain('aria-label="Couldn&#x27;t read down&#x27;s load."')
  })

  it('keeps only the bullets at the tightest density', () => {
    const markup = render(true)
    expect(bullets(markup)).toHaveLength(3)
    expect(markup).not.toContain('>dev<')
  })
})
