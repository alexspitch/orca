import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, MoreHorizontal, RefreshCw } from 'lucide-react-native'
import type {
  BuildWebConnectionStatus,
  BuildWebIssueRow
} from '../../../src/shared/build-web-types'
import { BUILD_WEB_RUNTIME_CAPABILITY } from '../../../src/shared/build-web-capability'
import { ActionSheetModal } from '../components/ActionSheetModal'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { MobileSegmentedControl } from '../components/MobileSegmentedControl'
import { MobileLoadErrorState } from '../components/MobileLoadErrorState'
import { StatusDot } from '../components/StatusDot'
import { useHostProtocolGates } from '../components/host-protocol-gates-context'
import { useBackClaim } from '../navigation/use-back-claim'
import { useRouteHandoff } from '../navigation/route-handoff'
import { useHostClient } from '../transport/host-client-hooks'
import { colors, spacing, typography } from '../theme/mobile-theme'
import type { BuildWebCardTab } from './build-web-card-tabs'
import { buildWebErrorMessage, callBuildWeb } from './build-web-operations'
import {
  BuildWebScreenContext,
  type BuildWebListSync,
  type BuildWebNoticeTone,
  type BuildWebScreen
} from './build-web-screen-context'
import { BuildWebConnectForm } from './BuildWebConnectForm'
import { BuildWebIssueListView } from './list/BuildWebIssueListView'
import { BuildWebIssueScreen } from './issue/BuildWebIssueScreen'
import { BuildWebTakeToWorkSheet } from './take-to-work/BuildWebTakeToWorkSheet'
import { BuildWebNoticeBanner, type BuildWebNotice } from './BuildWebNoticeBanner'
import { BuildWebImagesView } from './images/BuildWebImagesView'
import { BuildWebTasksView } from './tasks/BuildWebTasksView'
import { ImageTrackingContext, useImageTrackingState } from './images/image-tracking'

type OpenCard = { id: string; tab: BuildWebCardTab }
type Section = 'issues' | 'images' | 'tasks'

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'issues', label: 'Issues' },
  { value: 'images', label: 'Images' },
  { value: 'tasks', label: 'Tasks' }
]

const NOTICE_MS = 4000

/** The Issues page of a host: build-web's tasks and images, as the desktop shows them. */
export function MobileBuildWebScreen() {
  const { hostId } = useLocalSearchParams<{ hostId: string }>()
  const router = useRouteHandoff()
  const insets = useSafeAreaInsets()
  const { client: liveClient, state: connState } = useHostClient(hostId)
  // Why the last one: a reconnect must not unmount open cards, drafts and a pending launch.
  const lastClient = useRef(liveClient)
  if (liveClient) {
    lastClient.current = liveClient
  }
  const client = liveClient ?? lastClient.current
  const { hostCapabilities, statusPending, statusReadable } = useHostProtocolGates()
  const supported = hostCapabilities.includes(BUILD_WEB_RUNTIME_CAPABILITY)
  // Only a readable, settled host status may say build-web is missing; otherwise it is still loading.
  const capabilitiesKnown = statusReadable && !statusPending
  const [status, setStatus] = useState<BuildWebConnectionStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [cards, setCards] = useState<OpenCard[]>([])
  const [taking, setTaking] = useState<BuildWebIssueRow[] | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState<BuildWebNotice | null>(null)
  const [section, setSection] = useState<Section>('issues')
  // Why remembered: the Images section stays mounted once opened, so its filters survive a switch.
  const [imagesOpened, setImagesOpened] = useState(false)
  const [tasksOpened, setTasksOpened] = useState(false)
  const [image, setImage] = useState<string | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const notify = useCallback((message: string, tone: BuildWebNoticeTone = 'info') => {
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current)
    }
    setNotice({ message, tone })
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS)
  }, [])
  useEffect(
    () => () => {
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current)
      }
    },
    []
  )

  const refreshStatus = useCallback(async () => {
    if (!client || connState !== 'connected' || !supported) {
      return
    }
    setStatusError(null)
    try {
      setStatus(await callBuildWeb(client, 'status'))
    } catch (failure) {
      setStatusError(buildWebErrorMessage(failure))
    }
  }, [client, connState, supported])
  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const disconnect = useCallback(async () => {
    if (!client) {
      return
    }
    try {
      setStatus(await callBuildWeb(client, 'disconnect'))
      setCards([])
    } catch (failure) {
      notify(buildWebErrorMessage(failure), 'error')
    }
  }, [client, notify])

  // The mounted list registers its own handlers; a card reaches it through the context.
  const listHandlers = useRef<Partial<BuildWebListSync>>({})
  const listSync = useMemo<BuildWebListSync>(
    () => ({
      patch: (id, patch) => listHandlers.current.patch?.(id, patch),
      drop: (id) => listHandlers.current.drop?.(id),
      reload: () => listHandlers.current.reload?.()
    }),
    []
  )

  const openIssue = useCallback((id: string, tab: BuildWebCardTab = 'overview') => {
    setCards((open) => (open.at(-1)?.id === id ? open : [...open, { id, tab }]))
  }, [])
  const closeIssue = useCallback(() => setCards((open) => open.slice(0, -1)), [])

  const call = useMemo<BuildWebScreen['call'] | null>(
    () => (client ? (method, ...params) => callBuildWeb(client, method, ...params) : null),
    [client]
  )
  const tracking = useImageTrackingState(status?.connected ? call : null, notify)

  const screen = useMemo<BuildWebScreen | null>(
    () =>
      client && call && status?.connected
        ? {
            hostId,
            client,
            hostCapabilities,
            status,
            setStatus,
            call,
            openIssue,
            closeIssue,
            takeToWork: setTaking,
            listSync,
            registerList: (handlers: Partial<BuildWebListSync>) => {
              listHandlers.current = handlers
            },
            notify
          }
        : null,
    [call, client, closeIssue, hostCapabilities, hostId, listSync, notify, openIssue, status]
  )

  const card = section === 'issues' ? (cards.at(-1) ?? null) : null
  const imageShown = section === 'images' ? image : null
  useBackClaim(
    taking
      ? () => {
          setTaking(null)
          return true
        }
      : card
        ? () => {
            closeIssue()
            return true
          }
        : imageShown
          ? () => {
              setImage(null)
              return true
            }
          : null
  )

  const goBack = () => {
    if (card) {
      closeIssue()
      return
    }
    if (imageShown) {
      setImage(null)
      return
    }
    router.back()
  }

  const body = () => {
    if (screen) {
      return (
        <BuildWebScreenContext.Provider value={screen}>
          <ImageTrackingContext.Provider value={tracking}>
            {connState === 'connected' ? null : (
              <Text style={styles.reconnecting}>Reconnecting to the host…</Text>
            )}
            {card || imageShown ? null : (
              <View style={styles.sections}>
                <MobileSegmentedControl
                  segments={SECTIONS}
                  selected={section}
                  onSelect={(next) => {
                    setSection(next)
                    if (next === 'images') {
                      setImagesOpened(true)
                    } else if (next === 'tasks') {
                      setTasksOpened(true)
                    }
                  }}
                  fill
                />
              </View>
            )}
            {imagesOpened ? (
              <View style={[styles.fill, section === 'images' ? null : styles.hidden]}>
                <BuildWebImagesView
                  image={image}
                  active={section === 'images'}
                  reloadToken={reloadToken}
                  onOpenImage={setImage}
                />
              </View>
            ) : null}
            {tasksOpened ? (
              <View style={[styles.fill, section === 'tasks' ? null : styles.hidden]}>
                <BuildWebTasksView
                  active={section === 'tasks'}
                  onOpenIssue={(id) => {
                    setSection('issues')
                    openIssue(id, 'build')
                  }}
                  onOpenImage={(next) => {
                    setSection('images')
                    setImagesOpened(true)
                    setImage(next)
                  }}
                />
              </View>
            ) : null}
            {/* The list stays mounted under a card so its filters, page and scroll survive Back. */}
            <View style={[styles.fill, section === 'issues' && !card ? null : styles.hidden]}>
              <BuildWebIssueListView
                reloadToken={reloadToken}
                visible={section === 'issues' && !card}
              />
            </View>
            {card ? (
              <BuildWebIssueScreen
                key={`${cards.length}:${card.id}`}
                issueId={card.id}
                initialTab={card.tab}
                reloadToken={reloadToken}
              />
            ) : null}
            <BuildWebTakeToWorkSheet issues={taking} onClose={() => setTaking(null)} />
          </ImageTrackingContext.Provider>
        </BuildWebScreenContext.Provider>
      )
    }
    if (connState !== 'connected' || !client) {
      return <Centered label="Connecting…" />
    }
    if (!supported && !capabilitiesKnown) {
      return <Centered label="Loading…" />
    }
    if (!supported) {
      return (
        <MobileLoadErrorState message="This Orca server does not support build-web yet. Update the server to use Issues." />
      )
    }
    if (statusError && !status) {
      return <MobileLoadErrorState message={statusError} onRetry={() => void refreshStatus()} />
    }
    if (!status) {
      return <Centered label="Loading…" />
    }
    return <BuildWebConnectForm client={client} status={status} onConnected={setStatus} />
  }

  const connected = status?.connected === true
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          style={styles.iconButton}
          onPress={goBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.titleWrap}>
          <View style={styles.titleLine}>
            <StatusDot state={connState} />
            <Text style={styles.title}>{SECTIONS.find((s) => s.value === section)?.label}</Text>
          </View>
          {connected ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {status.login} · {status.baseUrl?.replace(/^https?:\/\//, '')}
            </Text>
          ) : null}
        </View>
        {connected ? (
          <>
            <Pressable
              style={styles.iconButton}
              onPress={() => setReloadToken((n) => n + 1)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Refresh"
            >
              <RefreshCw size={16} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              style={styles.iconButton}
              onPress={() => setMenuOpen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="More"
            >
              <MoreHorizontal size={18} color={colors.textSecondary} />
            </Pressable>
          </>
        ) : null}
      </View>
      <View style={styles.fill}>{body()}</View>
      <BuildWebNoticeBanner notice={notice} bottomInset={insets.bottom} />
      <ActionSheetModal
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        actions={[
          { label: 'Check connection', icon: RefreshCw, onPress: () => void refreshStatus() },
          { label: 'Disconnect', destructive: true, onPress: () => void disconnect() }
        ]}
      />
    </View>
  )
}

function Centered({ label }: { label: string }) {
  return (
    <View style={styles.centered}>
      <LoadingSpinner size={18} color={colors.textMuted} />
      <Text style={styles.subtitle}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgBase },
  fill: { flex: 1, minHeight: 0 },
  hidden: { display: 'none' },
  sections: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  iconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1, minWidth: 0 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.textPrimary, fontSize: typography.titleSize, fontWeight: '600' },
  subtitle: { color: colors.textMuted, fontSize: typography.metaSize },
  reconnecting: {
    color: colors.statusAmber,
    fontSize: typography.metaSize,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }
})
