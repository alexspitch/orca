import type http from 'node:http'
import { serveActivity } from './build-web-activity-mock'
import { serveImageBuilds, type ImageAdoption } from './build-web-images-mock'
import { serveIssues } from './build-web-issues-mock'
import { serveRecaps } from './build-web-recaps-mock'
import { serveTestHistory } from './build-web-test-history-mock'

/** The console routes of sections whose data lives in their own mock module; false when none. */
export function serveSectionRoutes(
  res: http.ServerResponse,
  path: string,
  url: URL,
  json: (res: http.ServerResponse, status: number, body: unknown) => void,
  adoptions: readonly ImageAdoption[]
): boolean {
  return (
    serveActivity(res, path, json) ||
    serveTestHistory(res, path, url, json) ||
    serveImageBuilds(res, path, json, adoptions) ||
    serveIssues(res, path, url, json) ||
    serveRecaps(res, path, url, json)
  )
}
