import { useState } from 'react'
import { toast } from 'sonner'
import { Bell, CircleAlert, Info, Trash2, TriangleAlert } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { formatUiRelativeTimeFromDate } from '@/i18n/relative-time-format'
import { cn } from '@/lib/utils'
import type {
  BuildWebActivity,
  BuildWebNotification
} from '../../../../../shared/build-web-activity-types'
import { callBuildWeb } from '../build-web-client'
import { notificationTarget } from './activity-targets'
import { ActivityCountBadge } from './ActivityCountBadge'
import { notificationBody, notificationKindLabel } from './notification-text'
import { openActivityTarget, type ActivityHost } from './open-activity-target'

type Notes = NonNullable<BuildWebActivity['notifications']>

function SeverityIcon({ severity }: { severity: BuildWebNotification['severity'] }) {
  if (severity === 'warning') {
    return <TriangleAlert className="mt-0.5 size-3.5 text-chip-tone-amber" />
  }
  if (severity === 'info') {
    return <Info className="mt-0.5 size-3.5 text-muted-foreground" />
  }
  return <CircleAlert className="mt-0.5 size-3.5 text-destructive" />
}

function NotificationRow({
  note,
  unread
}: {
  note: BuildWebNotification
  unread: boolean
}): React.JSX.Element {
  const body = notificationBody(note.body)
  const meta = [
    notificationKindLabel(note.kind),
    note.issue_key,
    note.last_at ? formatUiRelativeTimeFromDate(note.last_at, '') : '',
    note.count > 1 ? `×${note.count}` : ''
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <>
      <SeverityIcon severity={note.severity} />
      <span className="min-w-0 flex-1">
        <span className={cn('block break-words', unread && 'font-semibold')}>{note.title}</span>
        {body ? (
          <span className="line-clamp-2 font-mono text-2xs break-words whitespace-pre-wrap text-muted-foreground">
            {body}
          </span>
        ) : null}
        <span className="block text-2xs text-muted-foreground">{meta}</span>
      </span>
    </>
  )
}

/**
 * build-web's bell: failed builds and console errors, and the moves, assignments and comments of
 * the person's own tasks — what each person sees is the console's rule. Opening it marks all read.
 */
export function BuildWebNotificationMenu({
  notes,
  host
}: {
  notes: Notes
  host: ActivityHost
}): React.JSX.Element {
  // The rows unread when the menu opened: they keep their mark while it is open.
  const [marked, setMarked] = useState<ReadonlySet<string> | null>(null)
  // The reading the person marked read or cleared; the next reading is the console's own word.
  const [seenIn, setSeenIn] = useState<Notes | null>(null)
  const [clearedIn, setClearedIn] = useState<Notes | null>(null)
  const items = clearedIn === notes ? [] : notes.items
  const unread = marked || seenIn === notes || clearedIn === notes ? 0 : notes.unread
  const label =
    unread > 0
      ? translate(
          'buildWeb.activity.notificationsUnread',
          'build-web notifications, {{count}} new',
          {
            count: unread
          }
        )
      : translate('buildWeb.activity.notifications', 'build-web notifications')

  const onOpenChange = (open: boolean) => {
    if (!open) {
      setMarked(null)
      return
    }
    setMarked(new Set(items.filter((n) => n.unread).map((n) => n.id)))
    if (unread > 0) {
      setSeenIn(notes)
      void callBuildWeb(host.target, 'notificationsSeen').catch(() => {})
    }
  }

  const clear = async () => {
    setClearedIn(notes)
    try {
      const result = await callBuildWeb(host.target, 'notificationsClear')
      if (!result.ok) {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button className="sidebar-toggle sidebar-toggle-compact relative" aria-label={label}>
              <Bell size={14} />
              <ActivityCountBadge count={unread} tone="red" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {label}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-96">
        <DropdownMenuLabel>
          {translate('buildWeb.activity.notificationsTitle', 'Notifications')}
        </DropdownMenuLabel>
        {items.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            {translate('buildWeb.activity.noNotifications', 'No notifications')}
          </p>
        ) : null}
        {items.map((note) => {
          const where = notificationTarget(note)
          const unreadRow = marked ? marked.has(note.id) : note.unread
          return where ? (
            <DropdownMenuItem
              key={note.id}
              className="items-start"
              onSelect={() => void openActivityTarget(where, host)}
            >
              <NotificationRow note={note} unread={unreadRow} />
            </DropdownMenuItem>
          ) : (
            <div key={note.id} className="flex items-start gap-2 px-2 py-1 text-xs">
              <NotificationRow note={note} unread={unreadRow} />
            </div>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={items.length === 0} onSelect={() => void clear()}>
          <Trash2 />
          {translate('buildWeb.activity.clear', 'Clear')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
