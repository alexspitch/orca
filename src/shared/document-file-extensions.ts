export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

// Why only .docx: the older binary .doc is a different format no in-app viewer reads.
export const DOCUMENT_FILE_MIME_TYPES: Record<string, string> = {
  '.docx': DOCX_MIME_TYPE
}

export function isDocxFilePath(filePath: string): boolean {
  return /\.docx$/i.test(filePath)
}
