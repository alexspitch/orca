import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import { SourceFileRefWorktreeContext } from './SourceFileRefCode'

const worktreeId = () => 'wt'
const CONTENT = 'Change (`exec_input_node.py:160-257`) and `npm test`.'

function render(withWorktree: boolean, fadeWords = false): string {
  const markdown = (
    <CommentMarkdown
      content={CONTENT}
      variant="document"
      fileLinkExists={() => false}
      fadeWords={fadeWords}
    />
  )
  return renderToStaticMarkup(
    withWorktree ? (
      <SourceFileRefWorktreeContext.Provider value={worktreeId}>
        {markdown}
      </SourceFileRefWorktreeContext.Provider>
    ) : (
      markdown
    )
  )
}

describe('file references in a chat message', () => {
  it('are links where the chat names a worktree, even while words fade in', () => {
    for (const fadeWords of [false, true]) {
      const html = render(true, fadeWords)
      expect(html).toMatch(/<code role="link"[^>]*>exec_input_node\.py:160-257<\/code>/)
      expect(html).toMatch(/<code class="[^"]*">npm test<\/code>/)
    }
  })

  it('stay plain code elsewhere', () => {
    expect(render(false)).not.toContain('role="link"')
  })
})
