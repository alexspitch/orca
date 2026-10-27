import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { ListTodo } from 'lucide-react-native'
import type { BuildWebConnectionStatus } from '../../../src/shared/build-web-types'
import type { RpcClient } from '../transport/rpc-client'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { buildWebErrorMessage, callBuildWeb } from './build-web-operations'

const DEFAULT_BUILD_WEB_URL = 'https://tw.spitch-dev.ai:8585'

/** The desktop's URL and token form; the token is kept on the host, never on the phone. */
export function BuildWebConnectForm({
  client,
  status,
  onConnected
}: {
  client: RpcClient
  status: BuildWebConnectionStatus
  onConnected: (status: BuildWebConnectionStatus) => void
}) {
  const [baseUrl, setBaseUrl] = useState(status.baseUrl || DEFAULT_BUILD_WEB_URL)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(status.credentialError ?? null)
  const ready = !busy && token.trim() !== '' && baseUrl.trim() !== ''

  const submit = async () => {
    if (!ready) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await callBuildWeb(client, 'connect', { baseUrl, token })
      if (result.ok) {
        setToken('')
        onConnected(result.status)
      } else {
        setError(result.error)
      }
    } catch (failure) {
      setError(buildWebErrorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.intro}>
        <ListTodo size={32} color={colors.textMuted} strokeWidth={1.5} />
        <Text style={styles.title}>Connect build-web</Text>
        <Text style={styles.description}>
          See your build-web tasks here, and hand tasks to an agent in a worktree.
        </Text>
      </View>
      <Text style={styles.label}>build-web address</Text>
      <TextInput
        style={styles.input}
        value={baseUrl}
        onChangeText={setBaseUrl}
        placeholder={DEFAULT_BUILD_WEB_URL}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <Text style={styles.label}>API token</Text>
      <TextInput
        style={styles.input}
        value={token}
        onChangeText={setToken}
        placeholder="bwt_…"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        onSubmitEditing={() => void submit()}
      />
      <Text style={styles.hint}>
        Issue a dedicated token for Orca in build-web: the key icon in the header → My API tokens.
        Everyone using this Orca host acts as that account.
      </Text>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Pressable
        style={[styles.button, !ready && styles.buttonDisabled]}
        disabled={!ready}
        onPress={() => void submit()}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{busy ? 'Connecting…' : 'Connect'}</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.sm },
  intro: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  description: { color: colors.textMuted, fontSize: typography.bodySize, textAlign: 'center' },
  label: { color: colors.textSecondary, fontSize: typography.metaSize, marginTop: spacing.sm },
  input: {
    color: colors.textPrimary,
    backgroundColor: colors.bgPanel,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.bodySize
  },
  hint: { color: colors.textMuted, fontSize: typography.metaSize },
  error: { color: colors.statusRed, fontSize: typography.bodySize },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceBright,
    borderRadius: radii.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.md
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: colors.bgBase, fontWeight: '600', fontSize: typography.bodySize }
})
