import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import { isRunDue } from '../../core/feed/schedule'
import { executeRun } from '../../platform/feed-runner'
import { loadSettings, loadState } from '../../platform/feed-storage'

const ALARM = 'feed-tick'
// The tick only compares dates; the real limit of one automatic run a day is `isRunDue`.
// A dev build ticks every minute and treats two minutes as "a day", so a run can be watched.
const DEV = import.meta.env.DEV

async function maybeRunToday() {
  const [settings, state] = await Promise.all([loadSettings(), loadState()])
  if (!Object.values(settings.sources).some(Boolean)) return
  const now = new Date()
  const due = DEV ? now.getTime() - Date.parse(state.lastAutoRunAt || '1970-01-01') > 2 * 60 * 1000 : isRunDue(state.lastAutoRunAt, now, settings.fetchTime)
  if (due) await (await executeRun({ auto: true })).finished
}

export default defineBackground(() => {
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

  const schedule = () => browser.alarms.create(ALARM, { periodInMinutes: DEV ? 1 : 15 })
  browser.runtime.onInstalled.addListener(schedule)
  browser.runtime.onStartup.addListener(() => {
    schedule()
    void maybeRunToday() // a run missed while Chrome was closed
  })
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) void maybeRunToday()
  })

  // "Segarkan" from the options page. The answer is immediate; progress is followed in `feedState`.
  browser.runtime.onMessage.addListener((message: { type?: string }, _sender, reply) => {
    if (message.type !== 'feed:refresh') return
    void executeRun({ auto: false }).then((handle) => {
      reply(handle.status)
      void handle.finished.catch(() => {})
    }, () => reply('busy'))
    return true
  })
})
