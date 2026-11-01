import { defineFixture } from '../../../component-fixtures/component-fixture'
import type { BuildWebIssueEvent } from '../../../../../shared/build-web-types'
import { IssueActivityTab } from './IssueActivityTab'

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

const event = (id: string, over: Partial<BuildWebIssueEvent>): BuildWebIssueEvent => ({
  id,
  kind: 'edited',
  text: '',
  author: 'alex.trusov@spitch.ch',
  created_at: ago(Number(id) * 47),
  result: '',
  result_text: '',
  ...over
})

const events: BuildWebIssueEvent[] = [
  event('1', {
    kind: 'notify',
    text: 'Telegram: задача вышла — alex.trusov@spitch.ch',
    author: 'уведомления',
    result: 'ok'
  }),
  event('2', {
    kind: 'notify',
    text: 'Slack: задача вышла — iosif@spitch.ch',
    author: 'уведомления',
    result: 'failed',
    result_text: 'channel_not_found'
  }),
  event('3', {
    kind: 'notify',
    text: 'Колокольчик: alex.trusov',
    result: 'ok',
    result_text: 'записано'
  }),
  event('4', { kind: 'build', text: 'Сборка #412 на dc-3.0', author: 'train:night', result: 'ok' }),
  event('5', {
    kind: 'build',
    text: 'Сборка #411 на dc-3.0',
    author: 'сборка',
    result: 'cancelled'
  }),
  event('6', {
    text: 'Статус: В работе → Развёртывание; исполнитель: alex.trusov → oleg; стенд: dc-3-msi, версия 3.0.17.2 с длинным хвостом',
    author: 'watch'
  }),
  event('7', { kind: 'comment', text: 'Комментарий: «Проверь вход по SSO»', author: 'ai' }),
  event('8', { kind: 'guide', text: 'Guide записан', author: 'съёмка', result: 'ok' }),
  event('9', { kind: 'created', text: 'Задача создана' })
]

export const activity = defineFixture({
  width: 900,
  render: () => <IssueActivityTab target={{ kind: 'local' }} events={events} />
})

export const empty = defineFixture({
  width: 900,
  render: () => <IssueActivityTab target={{ kind: 'local' }} events={[]} />
})
