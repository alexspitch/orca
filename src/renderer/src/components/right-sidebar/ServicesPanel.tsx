import React from 'react'
import { useAppStore } from '@/store'
import { DevServicesView } from '@/components/dev-services/DevServicesView'

export default function ServicesPanel({ isVisible }: { isVisible: boolean }): React.JSX.Element {
  const worktreeId = useAppStore((state) => state.activeWorktreeId)
  return <DevServicesView worktreeId={worktreeId} isVisible={isVisible} />
}
