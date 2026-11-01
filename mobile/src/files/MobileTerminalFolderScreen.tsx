import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft, FileText } from 'lucide-react-native'
import type { RuntimeTerminalArtifactDirectoryListing } from '../../../src/shared/runtime-file-contracts'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { MobileLoadErrorState } from '../components/MobileLoadErrorState'
import { useWorkspaceRouteHandoff } from '../navigation/workspace-route-handoff'
import { colors, spacing, typography } from '../theme/mobile-theme'
import { useWorkspaceClient } from '../transport/use-workspace-client'
import {
  createMobileFilePreviewHref,
  type MobileFilePreviewRouteParams
} from './mobile-file-preview-route'
import { filePreviewStyles } from './mobile-file-preview-styles'
import {
  grantTerminalArtifactFolderFile,
  listTerminalArtifactFolder
} from './terminal-artifact-folder-operations'

// A server folder a terminal printed (an agent's scratchpad): its files, each opening in the preview.

const errorOf = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure)

function sizeOf(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`
}

export function MobileTerminalFolderScreen({
  params
}: {
  params: MobileFilePreviewRouteParams & { absolutePath: string; grantId: string }
}) {
  const router = useWorkspaceRouteHandoff()
  const { client, state } = useWorkspaceClient(params.hostId)
  const [listing, setListing] = useState<RuntimeTerminalArtifactDirectoryListing | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [opening, setOpening] = useState<string | null>(null)
  const folder = useMemo(
    () => ({
      worktreeId: params.worktreeId,
      absolutePath: params.absolutePath,
      grantId: params.grantId
    }),
    [params.worktreeId, params.absolutePath, params.grantId]
  )

  useEffect(() => {
    if (!client || state !== 'connected') {
      return
    }
    let alive = true
    setError(null)
    listTerminalArtifactFolder(client, folder).then(
      (value) => alive && setListing(value),
      (failure: unknown) => alive && setError(errorOf(failure))
    )
    return () => {
      alive = false
    }
  }, [client, state, reload, folder])

  const open = useCallback(
    (relativePath: string) => {
      if (!client || opening) {
        return
      }
      setOpening(relativePath)
      grantTerminalArtifactFolderFile(client, folder, relativePath)
        .then((file) =>
          router.push(
            createMobileFilePreviewHref({
              hostId: params.hostId,
              worktreeId: params.worktreeId,
              source: 'terminalArtifact',
              absolutePath: file.absolutePath,
              grantId: file.grantId,
              name: relativePath.split('/').pop() || relativePath,
              ...(params.worktreeName ? { worktreeName: params.worktreeName } : {})
            })
          )
        )
        .catch((failure: unknown) => setError(errorOf(failure)))
        .finally(() => setOpening(null))
    },
    [client, folder, opening, router, params.hostId, params.worktreeId, params.worktreeName]
  )

  return (
    <View style={filePreviewStyles.container}>
      <SafeAreaView style={filePreviewStyles.header} edges={['top']}>
        <View style={filePreviewStyles.topBar}>
          <Pressable
            style={({ pressed }) => [
              filePreviewStyles.backButton,
              pressed && filePreviewStyles.backButtonPressed
            ]}
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ChevronLeft size={22} color={colors.textSecondary} strokeWidth={2.2} />
          </Pressable>
          <View style={filePreviewStyles.titleBlock}>
            <Text style={filePreviewStyles.title} numberOfLines={1}>
              {params.name || 'Folder'}
            </Text>
            <Text style={filePreviewStyles.meta} numberOfLines={1}>
              {params.absolutePath}
            </Text>
          </View>
        </View>
      </SafeAreaView>
      {error ? (
        <MobileLoadErrorState message={error} onRetry={() => setReload((n) => n + 1)} />
      ) : listing === null ? (
        <View style={filePreviewStyles.state}>
          <LoadingSpinner size={18} color={colors.textMuted} />
        </View>
      ) : (
        <FlatList
          data={listing.entries}
          keyExtractor={(entry) => entry.relativePath}
          ListEmptyComponent={<Text style={styles.note}>The folder has no files.</Text>}
          ListFooterComponent={
            listing.truncated ? (
              <Text style={styles.note}>
                Only the first {listing.entries.length} files are listed.
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.relativePath}`}
              disabled={opening !== null}
              onPress={() => open(item.relativePath)}
              style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
            >
              <FileText size={16} color={colors.textSecondary} />
              <Text style={styles.path} numberOfLines={2}>
                {item.relativePath}
              </Text>
              {opening === item.relativePath ? (
                <LoadingSpinner size={14} color={colors.textMuted} />
              ) : (
                <Text style={styles.size}>{sizeOf(item.size)}</Text>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  pressed: { backgroundColor: colors.bgRaised },
  path: { flex: 1, color: colors.textPrimary, fontSize: typography.bodySize },
  size: { color: colors.textMuted, fontSize: typography.metaSize },
  note: { color: colors.textSecondary, padding: spacing.md }
})
