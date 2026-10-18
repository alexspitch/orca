import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { PaginationBar } from '@/components/task-page/PaginationBar'
import { translate } from '@/i18n/i18n'
import { BuildWebListState } from '../BuildWebListState'
import { IMAGE_PAGE_SIZE } from './use-build-web-images'

// Pieces the image list and one image's history share: search, version, count, states, pages.

export function ImageSearch({
  value,
  placeholder,
  wide,
  onChange
}: {
  value: string
  placeholder: string
  wide?: boolean
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={wide ? 'h-8 w-64' : 'h-8 w-48'}
      data-escape-clears-value="true"
    />
  )
}

export function VersionSelect({
  value,
  versions,
  onChange
}: {
  value: string
  versions: readonly string[]
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={translate('buildWeb.images.version', 'Product version')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          {translate('buildWeb.images.allVersions', 'All versions')}
        </SelectItem>
        {versions.map((v) => (
          <SelectItem key={v} value={v}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function FoundCount({ shown, of }: { shown: number; of: number }): React.JSX.Element {
  return (
    <span className="text-xs whitespace-nowrap text-muted-foreground">
      {translate('buildWeb.images.found', '{{shown}} of {{of}}', { shown, of })}
    </span>
  )
}

/** Error, loading or empty in place of the table; null when there are rows to show. */
export function ImageTableState({
  error,
  loading,
  empty,
  emptyText,
  onRetry
}: {
  error: string | null
  loading: boolean
  empty: boolean
  emptyText: string
  onRetry: () => void
}): React.JSX.Element | null {
  if (error) {
    return <BuildWebListState kind="error" error={error} onRetry={onRetry} />
  }
  if (!empty) {
    return null
  }
  return loading ? (
    <BuildWebListState
      kind="loading"
      loadingLabel={translate('buildWeb.images.loading', 'Loading images…')}
    />
  ) : (
    <p className="px-3 py-10 text-center text-sm text-muted-foreground md:px-5">{emptyText}</p>
  )
}

export function ImagePages({
  total,
  page,
  loading,
  onPageChange
}: {
  total: number
  page: number
  loading: boolean
  onPageChange: (page: number) => void
}): React.JSX.Element | null {
  return total > IMAGE_PAGE_SIZE ? (
    <PaginationBar
      currentPage={page}
      totalPages={Math.ceil(total / IMAGE_PAGE_SIZE)}
      loadingTarget={loading ? page : null}
      onPageChange={onPageChange}
    />
  ) : null
}
