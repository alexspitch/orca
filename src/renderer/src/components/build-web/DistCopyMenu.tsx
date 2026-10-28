import { useState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import {
  BUILD_WEB_DIST_CHOICES,
  type BuildWebDistChoice
} from '../../../../shared/build-web-dist-links'

export function distChoiceLabel(choice: BuildWebDistChoice): string {
  return choice === 'both' ? translate('buildWeb.copy.both', 'rhel + redos') : choice
}

/** IS-230.23: «Copy links» asks which distribution — a ticked rhel build gives its redos twin too. */
export function DistCopyMenu({
  linksOf,
  onCopy,
  label,
  size,
  variant
}: {
  linksOf: (choice: BuildWebDistChoice) => string[]
  /** True once the references are on the clipboard. */
  onCopy: (links: string[], choice: BuildWebDistChoice) => Promise<boolean>
  label: string
  size: 'xs' | 'sm'
  variant: 'outline' | 'ghost'
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const all = linksOf('both')
  const copy = async (choice: BuildWebDistChoice): Promise<void> => {
    if (await onCopy(linksOf(choice), choice)) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={all.length === 0}
          title={all.join('\n') || undefined}
        >
          <Copy />
          {copied ? translate('buildWeb.images.copied', 'Copied') : label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          {translate('buildWeb.copy.which', 'References of which distribution')}
        </DropdownMenuLabel>
        {BUILD_WEB_DIST_CHOICES.map((choice) => {
          const n = linksOf(choice).length
          return (
            <DropdownMenuItem key={choice} disabled={n === 0} onSelect={() => void copy(choice)}>
              {distChoiceLabel(choice)} ({n})
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
