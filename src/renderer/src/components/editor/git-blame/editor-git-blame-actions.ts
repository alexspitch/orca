import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { detectLanguage } from '@/lib/language-detect'
import { getRuntimeGitFileBlame } from '@/runtime/runtime-git-blame-client'
import type { GitBlameCommit } from '../../../../../shared/git-blame'
import { hasRuntimeRpcErrorCode } from '../../../../../shared/runtime-rpc-error-code'
import { resolveOpenFileGitContext } from '../open-file-git-context'
import {
  lineShasOf,
  setEditorGitBlame,
  useEditorGitBlame,
  type EditorGitBlame
} from './editor-git-blame-store'

function blameErrorMessage(error: unknown): string {
  if (hasRuntimeRpcErrorCode(error, 'method_not_found')) {
    return translate(
      'auto.components.editor.gitBlame.serverTooOld',
      'Update Orca on this server to use Git Blame.'
    )
  }
  const message = error instanceof Error ? error.message : String(error)
  if (/no such path|not a git repository/i.test(message)) {
    return translate('auto.components.editor.gitBlame.notTracked', 'This file is not in git.')
  }
  return translate('auto.components.editor.gitBlame.failed', 'Git blame failed: {{error}}', {
    error: message
  })
}

/** Blame `contents` — the editor's text — and show it beside the file's editor. */
export async function showEditorGitBlame(args: {
  fileId: string
  filePath: string
  relativePath: string
  contents: string
}): Promise<void> {
  const context = resolveOpenFileGitContext(args.filePath)
  if (!context) {
    return
  }
  // Identity marks this request: a hide or a newer request while it runs wins.
  const loading: EditorGitBlame = { status: 'loading' }
  const stillWanted = () => useEditorGitBlame.getState().byFile[args.fileId] === loading
  setEditorGitBlame(args.fileId, loading)
  try {
    const blame = await getRuntimeGitFileBlame(context, {
      relativePath: args.relativePath,
      contents: args.contents
    })
    if (stillWanted()) {
      setEditorGitBlame(args.fileId, {
        status: 'ready',
        commits: blame.commits,
        lineShas: lineShasOf(blame)
      })
    }
  } catch (error) {
    if (stillWanted()) {
      setEditorGitBlame(args.fileId, null)
      toast.error(blameErrorMessage(error))
    }
  }
}

export const hideEditorGitBlame = (fileId: string): void => setEditorGitBlame(fileId, null)

/** The commit's own change to this file, in a diff tab. */
export function openGitBlameCommit(filePath: string, commit: GitBlameCommit): void {
  const context = resolveOpenFileGitContext(filePath)
  if (!context) {
    return
  }
  const { previous } = commit
  const renamed = previous !== undefined && previous.path !== commit.path
  useAppStore.getState().openCommitDiff(
    context.worktreeId,
    context.worktreePath,
    {
      path: commit.path,
      status: !previous ? 'added' : renamed ? 'renamed' : 'modified',
      ...(renamed ? { oldPath: previous.path } : {})
    },
    {
      commitOid: commit.sha,
      parentOid: previous?.sha ?? null,
      compareRef: commit.sha.slice(0, 7),
      baseRef: previous ? previous.sha.slice(0, 7) : 'empty tree',
      subject: commit.summary
    },
    detectLanguage(commit.path),
    { runtimeEnvironmentId: context.runtimeEnvironmentId }
  )
}
