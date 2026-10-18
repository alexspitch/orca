import React from 'react'
import { useRepos } from '@/store/selectors'
import { translate } from '@/i18n/i18n'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { showsGitLogButton } from '../../../../shared/git-log-settings'
import { SearchableSetting } from '../settings/SearchableSetting'
import { SettingsRow, SettingsSwitchRow } from '../settings/SettingsFormControls'
import { gitLogRepos } from './resolve-git-log-selection'
import {
  GIT_LOG_SETTINGS_KEYWORDS,
  getGitLogSettingsDescription,
  getGitLogSettingsTitle
} from './git-log-settings-search'

const FOLLOW_ACTIVE = '__follow-active__'

/** Settings › Git: which project the Git page opens on, and whether its sidebar item shows. */
export function GitLogPageSettings({
  settings,
  updateSettings
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void | Promise<void>
}): React.JSX.Element {
  const repos = gitLogRepos(useRepos())
  const defaultRepoId = settings.gitLogDefaultRepoId ?? null
  const value =
    defaultRepoId && repos.some((repo) => repo.id === defaultRepoId) ? defaultRepoId : FOLLOW_ACTIVE
  const title = getGitLogSettingsTitle()

  return (
    <SearchableSetting
      title={title}
      description={getGitLogSettingsDescription()}
      keywords={GIT_LOG_SETTINGS_KEYWORDS}
      className="max-w-none"
    >
      <SettingsRow
        label={translate('gitLog.settings.defaultProject', 'Default Project')}
        description={translate(
          'gitLog.settings.defaultProjectDescription',
          'The project the Git page opens on. Following the active workspace falls back to the project opened there last.'
        )}
        alignTop
        control={
          <Select
            value={value}
            onValueChange={(next) =>
              void updateSettings({
                gitLogDefaultRepoId: next === FOLLOW_ACTIVE ? null : next
              })
            }
          >
            <SelectTrigger size="sm" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FOLLOW_ACTIVE}>
                {translate('gitLog.settings.followActive', 'Follow the active workspace')}
              </SelectItem>
              {repos.map((repo) => (
                <SelectItem key={repo.id} value={repo.id}>
                  {repo.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <SettingsSwitchRow
        label={translate('gitLog.settings.showButton', 'Show Git in the Sidebar')}
        description={translate(
          'gitLog.settings.showButtonDescription',
          'Adds the «Git» item under the sidebar’s navigation.'
        )}
        checked={showsGitLogButton(settings)}
        onChange={() =>
          void updateSettings({
            showGitLogButton: !showsGitLogButton(settings)
          })
        }
      />
    </SearchableSetting>
  )
}
