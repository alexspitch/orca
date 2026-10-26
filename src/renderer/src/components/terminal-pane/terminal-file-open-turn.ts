import { beginLinkOpenRequest } from '@/lib/link-open-request'
import { armLinkReturn } from '@/components/link-return/link-return-arm'

/** Supersedes earlier opens now, for a click still deciding what to open; true until a later open. */
export function reserveDetectedFilePathOpenTurn(armReturn = false): () => boolean {
  // Custom build: an in-app open remembers where the link was, so Back returns there.
  if (armReturn) {
    armLinkReturn()
  }
  return beginLinkOpenRequest()
}
