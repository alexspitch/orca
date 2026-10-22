import type React from 'react'

/** A Material Icon Theme icon, its own colours; 14px so it reads in a 12px row's icon slot. */
export function MaterialRowIcon({ url }: { url: string }): React.JSX.Element {
  return <img src={url} alt="" aria-hidden draggable={false} className="size-3.5 shrink-0" />
}
