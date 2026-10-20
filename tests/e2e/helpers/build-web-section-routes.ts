import type http from 'node:http'
import { serveImageBuilds } from './build-web-images-mock'
import { serveTestHistory } from './build-web-test-history-mock'

/** The console routes of sections whose data lives in their own mock module; false when none. */
export function serveSectionRoutes(
  res: http.ServerResponse,
  path: string,
  url: URL,
  json: (res: http.ServerResponse, status: number, body: unknown) => void
): boolean {
  return serveTestHistory(res, path, url, json) || serveImageBuilds(res, path, json)
}
