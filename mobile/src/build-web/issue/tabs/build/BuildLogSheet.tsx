import { Pressable } from 'react-native'
import { ExternalLink } from 'lucide-react-native'
import { BottomDrawer } from '../../../../components/BottomDrawer'
import { openExternalLink } from '../../../../platform/external-link'
import { colors } from '../../../../theme/mobile-theme'
import { LogLinesPanel } from '../../../LogLinesPanel'
import { useBuildLog } from './use-build-log'

/** A build's console log, followed while it runs, with find — the desktop's log dialog as a sheet. */
export function BuildLogSheet({
  log,
  onClose
}: {
  log: { url: string; title: string } | null
  onClose: () => void
}) {
  return (
    <BottomDrawer visible={log !== null} onClose={onClose} fillAvailable>
      {log ? <BuildLogBody key={log.url} log={log} /> : null}
    </BottomDrawer>
  )
}

// Why its own component: keyed by the log, its reads and find start over for another build.
function BuildLogBody({ log }: { log: { url: string; title: string } }) {
  const state = useBuildLog(log.url)
  return (
    <LogLinesPanel
      title={log.title}
      lines={state.lines}
      loading={!state.done && !state.error}
      error={state.error}
      {...(state.trimmed ? { note: 'only the tail is kept' } : {})}
      headerAction={
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open in Jenkins"
          hitSlop={8}
          onPress={() => openExternalLink(log.url)}
        >
          <ExternalLink size={16} color={colors.textSecondary} />
        </Pressable>
      }
    />
  )
}
