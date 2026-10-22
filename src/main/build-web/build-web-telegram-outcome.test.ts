import { beforeEach, describe, expect, it, vi } from 'vitest'

const request = vi.fn()
vi.mock('./build-web-connection', () => ({
  requireBuildWebCredential: () => ({ baseUrl: 'https://bw', token: 't', generation: 1 })
}))
vi.mock('./build-web-request', () => ({
  buildWebMutation: async (run: () => Promise<unknown>) => ({ ok: true, value: await run() }),
  buildWebRequest: (args: unknown) => request(args)
}))

const { addBuildWebComment, telegramOutcomeOf } = await import('./build-web-issue-write')

describe('a comment sent to Telegram', () => {
  beforeEach(() => {
    request.mockReset()
  })

  it('asks the console for the Telegram channel only when chosen', async () => {
    request.mockResolvedValue({ comment: { id: 'c1' }, jira: null, telegram: null })
    await addBuildWebComment('i1', 'hi', false)
    expect(request.mock.calls[0][0].body).toEqual({ body: 'hi', jira: false })
    request.mockResolvedValue({ comment: { id: 'c2' }, telegram: { ok: true, awaiting: true } })
    const result = await addBuildWebComment('i1', 'question', false, true)
    expect(request.mock.calls[1][0].body).toEqual({
      body: 'question',
      jira: false,
      channel: 'telegram'
    })
    expect(result).toEqual({
      ok: true,
      value: { id: 'c2', jira: null, telegram: { ok: true, awaiting: true } }
    })
  })

  it('reads whether it went and whether the task now awaits the answer', () => {
    expect(telegramOutcomeOf({ ok: true })).toEqual({ ok: true, awaiting: false })
    expect(telegramOutcomeOf({ ok: false, error: 'blocked the bot' })).toEqual({
      ok: false,
      error: 'blocked the bot'
    })
    expect(telegramOutcomeOf(null)).toBeNull()
  })
})
