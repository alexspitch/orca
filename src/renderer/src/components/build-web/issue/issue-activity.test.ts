import { describe, expect, it } from 'vitest'
import { activityActorOf, activityGroupOf, activityResultOf } from './issue-activity'

const WORDS = {
  delivered: 'delivered',
  success: 'success',
  notDelivered: 'not delivered',
  failed: 'failed',
  cancelled: 'cancelled'
}

describe('issue activity', () => {
  it('puts each kind under the console’s filter, an unknown one under changes', () => {
    expect(['comment', 'file', 'subtask'].map(activityGroupOf)).toEqual(['talk', 'talk', 'talk'])
    expect(activityGroupOf('notify')).toBe('notify')
    expect(activityGroupOf('build')).toBe('build')
    expect(['guide', 'jira'].map(activityGroupOf)).toEqual(['guide', 'guide'])
    expect(['created', 'edited', 'case', 'teleport', ''].map(activityGroupOf)).toEqual(
      Array(5).fill('changes')
    )
  })

  it('says a result as the console does', () => {
    const of = (kind: string, result: string, result_text = '') =>
      activityResultOf({ kind, result, result_text }, WORDS)
    expect(of('notify', 'ok')).toMatchObject({ label: 'delivered', tone: 'green' })
    expect(of('build', 'ok')).toMatchObject({ label: 'success', tone: 'green' })
    expect(of('notify', 'ok', 'записано')?.label).toBe('записано')
    expect(of('notify', 'failed', 'бот молчит')).toEqual({
      label: 'not delivered',
      tone: 'red',
      hint: 'бот молчит'
    })
    expect(of('build', 'failed')?.label).toBe('failed')
    expect(of('build', 'cancelled')).toMatchObject({ label: 'cancelled', tone: 'faint' })
    expect(of('edited', '')).toBeNull()
    expect(of('edited', 'maybe')).toBeNull()
  })

  it('names the console’s own actors and leaves people to the caller', () => {
    const words = { train: (n: string) => `train ${n}`, watch: 'watcher', ai: 'AI' }
    const person = (who: string) => who.split('@')[0]
    expect(activityActorOf('train:night', words, person)).toBe('train night')
    expect(activityActorOf('watch', words, person)).toBe('watcher')
    expect(activityActorOf('ai', words, person)).toBe('AI')
    expect(activityActorOf('ann@x.test', words, person)).toBe('ann')
    expect(activityActorOf('', words, person)).toBe('—')
  })
})
