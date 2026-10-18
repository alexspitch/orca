import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import type { BuildWebImageBuildArgs } from '../../../../../shared/build-web-image-types'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { callBuildWeb } from '../build-web-client'
import { useImageBuildRuns, versionOfBranch } from './image-build-runs'
import { testsChoice } from '../issue/build/run-cells'

const DISTS: BuildWebImageBuildArgs['dist'][] = ['both', 'rhel', 'redos']

function distLabel(dist: BuildWebImageBuildArgs['dist']): string {
  return dist === 'both' ? translate('buildWeb.imageBuild.both', 'rhel and redos') : dist
}

/** One image to a new build on a version (a branch) of its product, as build-web's «Собрать…». */
function BuildForm({
  target,
  image,
  product,
  initialBranch,
  onClose
}: {
  target: RuntimeClientTarget
  image: string
  product: string
  initialBranch?: string
  onClose: () => void
}): React.JSX.Element {
  const track = useImageBuildRuns((s) => s.track)
  const [branches, setBranches] = useState<string[] | null>(null)
  const [branch, setBranch] = useState('')
  const [dist, setDist] = useState<BuildWebImageBuildArgs['dist']>('both')
  const [ticket, setTicket] = useState('')
  // Off by default: a build from the tree goes without the offline suites unless asked.
  const [runTests, setRunTests] = useState(false)
  // Empty until read (or on an older host): every build then runs the tests, as Jenkins does.
  const [treeBranches, setTreeBranches] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    callBuildWeb(target, 'versionBranches', { product })
      .then((offered) => {
        if (alive) {
          // Why keep a branch outside the list: «build again» names the one the last build used.
          const list =
            initialBranch && !offered.includes(initialBranch)
              ? [initialBranch, ...offered]
              : offered
          setBranches(list)
          setBranch(initialBranch || list[0] || '')
        }
      })
      .catch((failure: unknown) => {
        if (alive) {
          setBranches([])
          setError(failure instanceof Error ? failure.message : String(failure))
        }
      })
    return () => {
      alive = false
    }
  }, [initialBranch, product, target])

  useEffect(() => {
    let alive = true
    callBuildWeb(target, 'branches')
      .then((list) => {
        if (alive) {
          setTreeBranches(new Set(list.filter((b) => b.fromTree).map((b) => b.name)))
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [target])
  const tests = testsChoice(branch ? [branch] : [], treeBranches, runTests)

  const start = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const result = await callBuildWeb(target, 'startImageBuild', {
        image,
        branch,
        dist,
        ...(ticket.trim() ? { ticket: ticket.trim() } : {}),
        ...(tests.skipTests ? { skipTests: true } : {})
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      track({ runId: result.value.runId, image, startedAt: Date.now() })
      toast.success(
        translate('buildWeb.imageBuild.started', 'Build of {{image}} started.', { image })
      )
      onClose()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{translate('buildWeb.imageBuild.title', 'Build the image')}</DialogTitle>
        <DialogDescription>
          <span className="font-mono">{image}</span>
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="image-build-version">
            {translate('buildWeb.imageBuild.version', 'Version')}
          </Label>
          <Select value={branch} disabled={!branches?.length} onValueChange={setBranch}>
            <SelectTrigger id="image-build-version" className="w-full">
              <SelectValue
                placeholder={
                  branches === null
                    ? translate('buildWeb.imageBuild.loadingVersions', 'Loading versions…')
                    : translate('buildWeb.imageBuild.noVersions', 'No versions')
                }
              />
            </SelectTrigger>
            <SelectContent>
              {(branches ?? []).map((b) => (
                <SelectItem key={b} value={b}>
                  {versionOfBranch(b)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {branch ? (
            <p className="text-xs text-muted-foreground">
              {translate('buildWeb.imageBuild.branch', 'Branch {{branch}}', { branch })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="image-build-dist">
            {translate('buildWeb.imageBuild.dist', 'Distribution')}
          </Label>
          <Select
            value={dist}
            onValueChange={(next) => setDist(DISTS.find((d) => d === next) ?? 'both')}
          >
            <SelectTrigger id="image-build-dist" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISTS.map((d) => (
                <SelectItem key={d} value={d}>
                  {distLabel(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="image-build-ticket">
            {translate('buildWeb.imageBuild.ticket', 'Ticket (optional)')}
          </Label>
          <Input
            id="image-build-ticket"
            value={ticket}
            onChange={(event) => setTicket(event.target.value)}
            placeholder={translate('buildWeb.imageBuild.ticketPlaceholder', 'SDAP-1234')}
          />
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="image-build-tests"
            emphasis="strong"
            className="mt-0.5"
            checked={!tests.skipTests}
            disabled={tests.forced || !branch}
            onCheckedChange={(checked) => setRunTests(checked === true)}
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="image-build-tests">
              {translate('buildWeb.run.runTests', 'Run tests')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {tests.forced
                ? translate(
                    'buildWeb.run.testsForced',
                    'Jenkins runs this build, and it always runs the tests'
                  )
                : translate(
                    'buildWeb.imageBuild.testsOff',
                    'unticked, the build goes without the offline suites'
                  )}
            </p>
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          {translate('buildWeb.imageBuild.cancel', 'Cancel')}
        </Button>
        <Button disabled={!branch || busy} onClick={() => void start()}>
          {translate('buildWeb.imageBuild.start', 'Start the build')}
        </Button>
      </DialogFooter>
    </>
  )
}

export function ImageBuildDialog({
  open,
  onOpenChange,
  ...props
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: RuntimeClientTarget
  image: string
  product: string
  /** The version to start from — the last build's branch when building it again. */
  initialBranch?: string
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Why remount per opening: versions and the form start fresh every time. */}
        {open ? <BuildForm {...props} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}
