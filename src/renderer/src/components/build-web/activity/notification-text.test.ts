import { describe, expect, it } from 'vitest'
import { notificationKindLabel } from './notification-text'

describe('what kind of bell row it is', () => {
  it('names the Telegram rows of build-web in words', () => {
    expect(notificationKindLabel('telegram_reply')).toBe('Telegram reply')
    expect(notificationKindLabel('telegram_link')).toBe('Telegram link request')
  })

  it('shows a kind it does not know as it came', () => {
    expect(notificationKindLabel('something_new')).toBe('something_new')
  })
})
