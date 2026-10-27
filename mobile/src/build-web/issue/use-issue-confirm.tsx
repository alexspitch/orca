import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ConfirmModal } from '../../components/ConfirmModal'

export type IssueConfirmRequest = {
  title: string
  message?: string
  confirmLabel?: string
  destructive?: boolean
}

export type IssueConfirm = (request: IssueConfirmRequest) => Promise<boolean>

/** The desktop's `useConfirmationDialog`: a question that resolves true only on its confirm button. */
export function useIssueConfirm(): { confirm: IssueConfirm; confirmElement: ReactNode } {
  // Why kept after close: the sheet still shows its words while it slides away.
  const [request, setRequest] = useState<IssueConfirmRequest | null>(null)
  const [open, setOpen] = useState(false)
  const resolver = useRef<((accepted: boolean) => void) | null>(null)
  const settle = (accepted: boolean) => {
    resolver.current?.(accepted)
    resolver.current = null
  }
  const confirm = useCallback<IssueConfirm>((next) => {
    resolver.current?.(false)
    setRequest(next)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])
  const confirmElement = request ? (
    <ConfirmModal
      visible={open}
      title={request.title}
      message={request.message}
      confirmLabel={request.confirmLabel}
      destructive={request.destructive}
      onConfirm={() => settle(true)}
      onCancel={() => {
        settle(false)
        setOpen(false)
      }}
    />
  ) : null
  return { confirm, confirmElement }
}
