import { useEffect, useState, type JSX } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import changelogFile from './custom-changelog.json'
import {
  changelogReleasesOf,
  isInstalledRelease,
  releaseBaseVersion,
  releaseDateLabel,
  type ChangelogRelease
} from './changelog-releases'

const RELEASES = changelogReleasesOf(changelogFile)

function sectionsOf(release: ChangelogRelease): { title: string; items: string[] }[] {
  return [
    { title: translate('changelog.features', 'New'), items: release.features },
    { title: translate('changelog.settings', 'Settings'), items: release.settings },
    { title: translate('changelog.fixes', 'Fixes'), items: release.fixes }
  ].filter((s) => s.items.length > 0)
}

function ReleaseEntry({
  release,
  appVersion
}: {
  release: ChangelogRelease
  appVersion: string | null
}): JSX.Element {
  const sections = sectionsOf(release)
  return (
    <section className="border-b border-border px-6 py-4 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="text-sm font-semibold" title={release.version}>
          {releaseBaseVersion(release.version)}
        </h3>
        <span className="text-xs text-muted-foreground">{releaseDateLabel(release.date)}</span>
        {isInstalledRelease(release, appVersion) ? (
          <Badge variant="secondary">{translate('changelog.installed', 'Installed')}</Badge>
        ) : null}
      </div>
      {release.note ? <p className="mt-1 text-xs text-muted-foreground">{release.note}</p> : null}
      {sections.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {translate('changelog.noChanges', 'No user-visible changes.')}
        </p>
      ) : (
        sections.map((s) => (
          <div key={s.title} className="mt-3">
            <h4 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
              {s.title}
            </h4>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}

/** What changed in each custom release, newest first — written by orca-release. */
export default function ChangelogDialog(): JSX.Element | null {
  const isOpen = useAppStore((s) => s.activeModal === 'changelog')
  const closeModal = useAppStore((s) => s.closeModal)
  const [appVersion, setAppVersion] = useState<string | null>(null)
  useEffect(() => {
    if (!isOpen) {
      return
    }
    let alive = true
    void window.api.updater.getVersion().then(
      (version) => alive && setAppVersion(version),
      () => alive && setAppVersion(null)
    )
    return () => {
      alive = false
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }
  return (
    <Dialog open onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="grid max-h-[min(760px,calc(100vh-2rem))] w-[min(680px,calc(100vw-2rem))] max-w-none grid-rows-[auto_minmax(0,1fr)] sm:max-w-none">
        <DialogHeader>
          <DialogTitle>{translate('changelog.title', 'Changelog')}</DialogTitle>
          <DialogDescription>
            {appVersion
              ? translate('changelog.installedVersion', 'Installed: {{version}}', {
                  version: appVersion
                })
              : translate('changelog.description', 'What changed in each release, newest first.')}
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-6 min-h-0 border-t border-border">
          <ScrollArea className="h-full">
            {RELEASES.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                {translate(
                  'changelog.empty',
                  'No releases recorded yet. The next orca-release writes the first entry.'
                )}
              </p>
            ) : (
              RELEASES.map((release) => (
                <ReleaseEntry key={release.version} release={release} appVersion={appVersion} />
              ))
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
