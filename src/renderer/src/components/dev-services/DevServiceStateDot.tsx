import React from 'react'
import { cn } from '@/lib/utils'
import type { DevServicesServiceState } from '../../../../shared/dev-services-contract'

const STATE_DOT_CLASS: Record<DevServicesServiceState, string> = {
  ready: 'bg-status-success',
  starting: 'bg-foreground/70 animate-pulse motion-reduce:animate-none',
  stopping: 'bg-status-warning',
  crashed: 'bg-destructive',
  stopped: 'border border-muted-foreground',
  absent: 'border border-dashed border-muted-foreground/60',
  shared: 'bg-muted-foreground/50',
  unknown: 'border border-dashed border-muted-foreground'
}

export function DevServiceStateDot({
  state,
  label
}: {
  state: DevServicesServiceState
  label: string
}): React.JSX.Element {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn('mt-1 inline-block size-2 shrink-0 rounded-full', STATE_DOT_CLASS[state])}
    />
  )
}
