import { translate } from '@/i18n/i18n'
import { matchesSettingsSearch } from '../settings/settings-search'

export const GIT_LOG_SETTINGS_KEYWORDS = [
  'git page',
  'git log',
  'webstorm',
  'default project',
  'branches',
  'history',
  'sidebar'
]

export function getGitLogSettingsTitle(): string {
  return translate('gitLog.settings.title', 'Git Page')
}

export function getGitLogSettingsDescription(): string {
  return translate(
    'gitLog.settings.description',
    'The «Git» sidebar item: a project’s log across all branches, as in WebStorm.'
  )
}

export function gitLogSettingsMatchSearch(searchQuery: string): boolean {
  return matchesSettingsSearch(searchQuery, {
    title: getGitLogSettingsTitle(),
    description: getGitLogSettingsDescription(),
    keywords: GIT_LOG_SETTINGS_KEYWORDS
  })
}

export function getGitLogSettingsSearchEntries(): {
  title: string
  description: string
  keywords: string[]
}[] {
  return [
    {
      title: getGitLogSettingsTitle(),
      description: getGitLogSettingsDescription(),
      keywords: GIT_LOG_SETTINGS_KEYWORDS
    }
  ]
}
