import { useCallback, useRef, useState } from 'react'
import { ConfirmModal } from '../../components/ConfirmModal'

// The desktop's useConfirmationDialog: ask, and await the answer.

type ConfirmRequest = {
  title: string
  message?: string
  confirmLabel?: string
  destructive?: boolean
}

export function useConfirmPrompt() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const resolver = useRef<((accepted: boolean) => void) | null>(null)

  const confirm = useCallback((next: ConfirmRequest) => {
    resolver.current?.(false)
    setRequest(next)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = (accepted: boolean) => {
    resolver.current?.(accepted)
    resolver.current = null
    setRequest(null)
  }

  const element = (
    <ConfirmModal
      visible={request !== null}
      title={request?.title ?? ''}
      message={request?.message}
      confirmLabel={request?.confirmLabel}
      destructive={request?.destructive}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  )

  return { confirm, element }
}
