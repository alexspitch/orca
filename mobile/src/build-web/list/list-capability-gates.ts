import {
  BUILD_WEB_ISSUE_ARCHIVE_RUNTIME_CAPABILITY,
  BUILD_WEB_ISSUE_ASSIGNEE_FILTER_RUNTIME_CAPABILITY,
  BUILD_WEB_ISSUE_FAVORITE_SORT_RUNTIME_CAPABILITY,
  BUILD_WEB_PRODUCT_CP_RUNTIME_CAPABILITY,
  BUILD_WEB_SAVED_QUERIES_RUNTIME_CAPABILITY
} from '../../../../src/shared/build-web-capability'
import type { BuildWebIssueQuery } from '../../../../src/shared/build-web-types'

// The desktop build-web-client's NEWER_METHODS / NEWER_ARGUMENTS for the list's calls: an older
// server refuses these with a raw validation error, so ask first and say what to update.

export function listIssuesRefusal(
  capabilities: readonly string[],
  query: BuildWebIssueQuery
): string | null {
  if (
    query.product?.includes('cp') &&
    !capabilities.includes(BUILD_WEB_PRODUCT_CP_RUNTIME_CAPABILITY)
  ) {
    return CHAT_PLATFORM_REFUSAL
  }
  if (
    query.sort === 'favorite' &&
    !capabilities.includes(BUILD_WEB_ISSUE_FAVORITE_SORT_RUNTIME_CAPABILITY)
  ) {
    return 'This Orca server cannot sort tasks by favorites yet. Update the server, or sort by another column.'
  }
  if (
    query.archived === true &&
    !capabilities.includes(BUILD_WEB_ISSUE_ARCHIVE_RUNTIME_CAPABILITY)
  ) {
    return 'This Orca server cannot list the archive yet. Update the server, or turn the Archive filter off.'
  }
  if (
    query.assignee?.length &&
    !capabilities.includes(BUILD_WEB_ISSUE_ASSIGNEE_FILTER_RUNTIME_CAPABILITY)
  ) {
    return 'This Orca server cannot filter tasks by assignee yet. Update the server, or clear the Assignee filter.'
  }
  return null
}

const CHAT_PLATFORM_REFUSAL = 'This Orca server does not know Chat Platform yet. Update the server.'

export function savedQueriesRefusal(capabilities: readonly string[]): string | null {
  return capabilities.includes(BUILD_WEB_SAVED_QUERIES_RUNTIME_CAPABILITY)
    ? null
    : 'This Orca server does not keep saved queries yet. Update the server.'
}

/** A saved query for product `cp`, or for every product (which includes it), on an older server. */
export function savedQueryProductsRefusal(
  capabilities: readonly string[],
  products: readonly string[]
): string | null {
  return products.includes('cp') && !capabilities.includes(BUILD_WEB_PRODUCT_CP_RUNTIME_CAPABILITY)
    ? CHAT_PLATFORM_REFUSAL
    : null
}
