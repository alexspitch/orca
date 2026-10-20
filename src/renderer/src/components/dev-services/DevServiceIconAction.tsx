import React from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Icon-only row/header action; spins while its request is in flight so it cannot fire twice. */
export function DevServiceIconAction({
  label,
  icon,
  busy = false,
  onClick
}: {
  label: string
  icon: React.ReactNode
  busy?: boolean
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={busy}
          aria-label={label}
          onClick={onClick}
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
