// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true
import React, { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NoticeCard, type NoticeCardTone } from './NoticeCard'
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
const empty: Array<[string, ReactNode]> = [
  ['missing', undefined], ['null', null], ['false', false], ['empty string', ''], ['whitespace', ' \n '],
  ['empty list', []], ['empty fragment', <>{false}</>], ['empty paragraph', <p />],
  ['action-only', <button>Retry</button>],
]
for (const tone of ['info', 'success', 'warning', 'error'] satisfies NoticeCardTone[]) {
  it.each(empty)(`${tone} always has a heading and supporting text when content is %s`, async (_name, content) => {
    await act(async () => root.render(<NoticeCard tone={tone} title=" ">{content}</NoticeCard>))
    expect(container.querySelector('.dv-notice-title')?.textContent?.trim()).toBeTruthy()
    const body = container.querySelector('.dv-notice-body')!.cloneNode(true) as HTMLElement
    body.querySelectorAll('button').forEach(el => el.remove())
    expect(body.textContent?.trim().length).toBeGreaterThan(20)
  })
}
it('preserves authored explanations, rich content, and notice actions', async () => {
  const dismiss = vi.fn(), open = vi.fn()
  await act(async () => root.render(<NoticeCard title="Track unavailable" onDismiss={dismiss} onOpen={open}>
    Reconnect <strong>your audio device</strong> and retry.
  </NoticeCard>))
  expect(container.querySelector('.dv-notice-body')?.textContent).toBe('Reconnect your audio device and retry.')
  await act(async () => { container.querySelector<HTMLButtonElement>('.dv-notice-dismiss')!.click(); container.querySelector<HTMLButtonElement>('.dv-notice-open')!.click() })
  expect(dismiss).toHaveBeenCalledOnce()
  expect(open).toHaveBeenCalledOnce()
})
