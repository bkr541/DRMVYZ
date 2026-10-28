import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDeveloperLogConsumer, subscribeDeveloperLogNotices } from './developerLogNotices'
import { useNotificationStore } from '../stores/notificationStore'
import type { NativeMainLogAppendChunk } from '../native/diagnosticsBridge'

const line = (level: string, message: string) => `[2026-10-28 10:00:00.001] [${level}] (react:renderer) ${message}\n`
beforeEach(() => useNotificationStore.getState().clearDeveloperEvents())

describe('developer log notices', () => {
  it('filters severity, preserves split headers and updates multiline errors', () => {
    const emit = vi.fn()
    const consume = createDeveloperLogConsumer(emit)
    consume(line('info', 'ready') + line('debug', 'tick'))
    expect(emit).not.toHaveBeenCalled()
    const warning = line('warn', 'GPU slow')
    consume(warning.slice(0, 12))
    expect(emit).not.toHaveBeenCalled()
    consume(warning.slice(12) + line('error', 'Lost context') + '  at render')
    expect(emit).toHaveBeenCalledTimes(2)
    const id = emit.mock.calls[1][0].id
    consume('Frame()\n')
    expect(emit.mock.lastCall).toEqual([expect.objectContaining({ id, tone: 'error', message: expect.stringContaining('  at renderFrame()') }), false])
  })

  it('does not subscribe for normal users and clears developer notices', () => {
    useNotificationStore.getState().upsertDeveloperEvent({ id: 'old', title: 'old', message: 'old', tone: 'error', unread: true })
    const watchMainLog = vi.fn()
    subscribeDeveloperLogNotices(false, { watchMainLog })()
    expect(watchMainLog).not.toHaveBeenCalled()
    expect(useNotificationStore.getState().developerEvents).toEqual([])
  })

  it('shares global events, keeps read/dismiss state during stack updates and stops on cleanup', () => {
    let append!: (chunk: NativeMainLogAppendChunk) => void
    const unsubscribe = vi.fn()
    const stop = subscribeDeveloperLogNotices(true, { watchMainLog: callback => { append = callback; return unsubscribe } })
    append({ content: line('warn', 'Warning') })
    let state = useNotificationStore.getState()
    expect(state.developerEvents).toHaveLength(1)
    const id = state.developerEvents[0].id
    state.markEventsRead('show-manager')
    append({ content: 'context\n' })
    expect(useNotificationStore.getState().developerEvents[0].unread).toBe(false)
    state.dismissEvent('react', id)
    append({ content: 'more context\n' })
    expect(useNotificationStore.getState().developerEvents).toHaveLength(0)
    append({ content: line('error', 'New error') })
    stop()
    append({ content: line('error', 'Too late') })
    state = useNotificationStore.getState()
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(state.developerEvents).toHaveLength(0)
  })

  it('resets torn lines on rotation and bounds notification retention', () => {
    const consume = createDeveloperLogConsumer((event, create) => useNotificationStore.getState().upsertDeveloperEvent(event, create))
    consume('[2026-torn')
    consume(line('error', 'Rotated'), true)
    expect(useNotificationStore.getState().developerEvents[0].message).toContain('Rotated')
    for (let i = 0; i < 30; i++) consume(line('warn', `warning ${i}`))
    expect(useNotificationStore.getState().developerEvents).toHaveLength(20)
  })
})
