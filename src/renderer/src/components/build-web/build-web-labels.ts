import type {
  BuildWebIssueProduct,
  BuildWebIssueStatus,
  BuildWebView
} from '../../../../shared/build-web-types'
import { translate } from '@/i18n/i18n'

// Labels are looked up when drawn, never cached at import: the language can change at runtime.

export function statusLabel(status: BuildWebIssueStatus): string {
  switch (status) {
    case 'unknown':
      return translate('buildWeb.status.unknown', 'Unknown')
    case 'todo':
      return translate('buildWeb.status.todo', 'To do')
    case 'planned':
      return translate('buildWeb.status.planned', 'Planned')
    case 'inprogress':
      return translate('buildWeb.status.inprogress', 'In progress')
    case 'paused':
      return translate('buildWeb.status.paused', 'Paused')
    case 'awaiting_response':
      return translate('buildWeb.status.awaitingResponse', 'Awaiting response')
    case 'deploying':
      return translate('buildWeb.status.deploying', 'Deploying')
    case 'build_failed':
      return translate('buildWeb.status.buildFailed', 'Build failed')
    case 'testing':
      return translate('buildWeb.status.testing', 'Testing')
    case 'testing_external':
      return translate('buildWeb.status.testingExternal', 'External testing')
    case 'done':
      return translate('buildWeb.status.done', 'Done')
    case 'wontfix':
      return translate('buildWeb.status.wontfix', "Won't fix")
  }
}

export function viewLabel(view: BuildWebView): string {
  switch (view) {
    case 'mine':
      return translate('buildWeb.view.mine', 'Mine')
    case 'ai':
      return translate('buildWeb.view.ai', 'For AI')
    case 'favorite':
      return translate('buildWeb.view.favorite', 'Favorites')
    case 'all':
      return translate('buildWeb.view.all', 'All')
  }
}

export function productLabel(product: BuildWebIssueProduct): string {
  if (product === 'unknown') {
    return translate('buildWeb.product.unknown', 'Unknown')
  }
  return product === 'storage' ? 'Storage' : product === 'tools' ? 'Tools' : product.toUpperCase()
}

/** A status chip tone from existing tokens — closed work recedes, a failed build stands out. */
export function statusTone(status: BuildWebIssueStatus): 'secondary' | 'outline' | 'destructive' {
  if (status === 'build_failed') {
    return 'destructive'
  }
  return status === 'done' || status === 'wontfix' ? 'outline' : 'secondary'
}
