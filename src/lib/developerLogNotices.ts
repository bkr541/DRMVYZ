import { parseMainLogText, type MainLogEntry } from './mainLogParser'
import type { NativeDiagnosticsBridge } from '../native/diagnosticsBridge'
import { useNotificationStore, type NotificationEvent } from '../stores/notificationStore'

/** Streaming lines preserve split writes and update stack traces without duplicate cards. */
export function createDeveloperLogConsumer(emit: (event: NotificationEvent, create: boolean) => void): (content: string, reset?: boolean) => void {
  let partial = ''
  let current: MainLogEntry | undefined
  return (content, reset = false) => {
    if (reset) { partial = ''; current = undefined }
    const lines = (partial + content).split('\n')
    partial = lines.pop()!.slice(-65536)
    for (const raw of lines) {
      const line = raw.replace(/\r$/, '')
      const parsed = parseMainLogText(line)[0]
      const isNew = parsed?.timestamp != null
      if (isNew) current = parsed
      else if (current) current.message = `${current.message}\n${line}`.slice(0, 16384)
      if (!current || (current.level !== 'warn' && current.level !== 'error')) continue
      emit({
        id: `developer-log-${current.id}`,
        tone: current.level === 'warn' ? 'warning' : 'error',
        title: `System log ${current.level === 'warn' ? 'warning' : 'error'} · ${current.component}${current.scope ? ` / ${current.scope}` : ''}`,
        message: `${current.timestampRaw}\n${current.message.slice(0, 16384)}`,
        unread: true,
      }, isNew)
    }
  }
}

export function subscribeDeveloperLogNotices(allowed: boolean, bridge: NativeDiagnosticsBridge | null): () => void {
  const store = useNotificationStore.getState()
  store.clearDeveloperEvents()
  if (!allowed || !bridge?.watchMainLog) return () => {}
  let active = true
  const consume = createDeveloperLogConsumer((event, create) => {
    if (active) store.upsertDeveloperEvent(event, create)
  })
  const unsubscribe = bridge.watchMainLog(chunk => { if (active) consume(chunk.content, chunk.reset) })
  return () => { active = false; unsubscribe(); store.clearDeveloperEvents() }
}
