import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import type { BuildWebCombo, BuildWebPushAfter } from '../../../../../../shared/build-web-run-types'
import { testsChoice, type Cell } from './run-cells'

// build-web's two menus: what a build publishes once it lands, chosen when it is started, and
// what a push publishes. One trigger each — a row's ▶, ↻ or badge, or a button over the selection.

function MenuLine({ title, hint }: { title: string; hint: string }): React.JSX.Element {
  return (
    <span className="flex flex-col">
      <span>{title}</span>
      <span className="text-2xs text-muted-foreground">{hint}</span>
    </span>
  )
}

function buildOptions(): { pushAfter: BuildWebPushAfter; title: string; hint: string }[] {
  return [
    {
      pushAfter: 'none',
      title: translate('buildWeb.run.buildNoPush', 'Build, don’t push'),
      hint: translate('buildWeb.run.buildNoPushHint', 'the image stays on the build server')
    },
    {
      pushAfter: 'build-tag',
      title: translate('buildWeb.run.buildPushBuildTag', 'Build + push build tag'),
      hint: translate(
        'buildWeb.run.buildPushBuildTagHint',
        'publishes <ver>bNNNN only; the moving tag stays where it is'
      )
    },
    {
      pushAfter: 'all',
      title: translate('buildWeb.run.buildPushAll', 'Build + push all tags'),
      hint: translate(
        'buildWeb.run.buildPushAllHint',
        'also moves <ver> — the tag guard still refuses to move it backwards'
      )
    }
  ]
}

export function BuildMenu({
  combos,
  treeBranches,
  disabled,
  onBuild,
  children
}: {
  combos: BuildWebCombo[]
  treeBranches: ReadonlySet<string>
  disabled?: boolean
  onBuild: (combos: BuildWebCombo[], pushAfter: BuildWebPushAfter, skipTests: boolean) => void
  /** The trigger. */
  children: React.ReactNode
}): React.JSX.Element {
  // «Run tests» is off again every time the menu closes, as in build-web.
  const [runTests, setRunTests] = useState(false)
  const tests = testsChoice(
    combos.map((c) => c.branch),
    treeBranches,
    runTests
  )
  return (
    <DropdownMenu onOpenChange={(open) => !open && setRunTests(false)}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuCheckboxItem
          checked={!tests.skipTests}
          disabled={tests.forced}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={(checked) => setRunTests(checked === true)}
        >
          <MenuLine
            title={translate('buildWeb.run.runTests', 'Run tests')}
            hint={
              tests.forced
                ? translate(
                    'buildWeb.run.testsForced',
                    'Jenkins runs this build, and it always runs the tests'
                  )
                : translate(
                    'buildWeb.run.testsOff',
                    'unticked, a build from the tree (master) goes without the offline suites'
                  )
            }
          />
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {buildOptions().map((o) => (
          <DropdownMenuItem
            key={o.pushAfter}
            onSelect={() => onBuild(combos, o.pushAfter, tests.skipTests)}
          >
            <MenuLine title={o.title} hint={o.hint} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PushMenu({
  cells,
  disabled,
  onPush,
  children
}: {
  cells: Cell[]
  disabled?: boolean
  onPush: (cells: Cell[], moveMainTag: boolean) => void
  children: React.ReactNode
}): React.JSX.Element {
  const allPushed = cells.every((c) => c.pushed)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {allPushed ? null : (
          <DropdownMenuItem onSelect={() => onPush(cells, false)}>
            {translate('buildWeb.run.pushBuildTag', 'Push build tag only')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => onPush(cells, true)}>
          {allPushed
            ? translate('buildWeb.run.pushMainTag', 'Push main tag')
            : translate('buildWeb.run.pushBoth', 'Push main + build tag')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
