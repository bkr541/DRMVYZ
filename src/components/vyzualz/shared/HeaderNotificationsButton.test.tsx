// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationPageProvider, notify, useNotificationStore } from '../../../stores/notificationStore'
import type { AppPageId } from '../../../stores/pageActivityStore'
import { DrawerNotice } from './DrawerNotice'
import { HeaderNotificationsButton } from './HeaderNotificationsButton'

let container: HTMLElement
let root: ReturnType<typeof createRoot>

const EMPTY_PAGES = { 'react': [], 'show-manager': [], 'media-manager': [], 'lyric-manager': [] }

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  useNotificationStore.setState({ pages: EMPTY_PAGES, slots: {}, events: EMPTY_PAGES })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.body.querySelectorAll('.vz-notifications-overlay').forEach(node => node.remove())
  vi.useRealTimers()
})

const bell = () => container.querySelector<HTMLButtonElement>('.vz-header-notifications')!
const drawer = () => document.body.querySelector<HTMLElement>('.vz-notifications-drawer')
const drawerTitles = () => [...document.body.querySelectorAll('.vz-notifications-drawer .dv-notice-title')].map(node => node.textContent)

function Page({ page, children }: { page: AppPageId; children: React.ReactNode }) {
  return (
    <NotificationPageProvider value={page}>
      <HeaderNotificationsButton page={page} />
      {children}
    </NotificationPageProvider>
  )
}

describe('DrawerNotice', () => {
  it('uses a labeled status chip in the React header only', async () => {
    await act(async () => root.render(<Page page="react"><span /></Page>))
    expect(bell().textContent).toContain('Notifications')
    expect(bell().classList.contains('vz-header-chip--labeled')).toBe(true)

    await act(async () => root.render(<Page page="media-manager"><span /></Page>))
    expect(bell().textContent).not.toContain('Notifications')
    expect(bell().classList.contains('vz-header-chip--square')).toBe(true)
  })

  it('draws its NoticeCard inline when there is no page around it', async () => {
    await act(async () => root.render(<DrawerNotice tone="warning" title="Standalone">Body</DrawerNotice>))
    expect(container.querySelector('.dv-notice-title')?.textContent).toBe('Standalone')
  })

  it('moves the card into the page\'s Notifications drawer instead of drawing it in place', async () => {
    await act(async () => root.render(
      <Page page="lyric-manager"><div id="body"><DrawerNotice tone="error" role="alert" title="Extraction failed">Provider offline.</DrawerNotice></div></Page>,
    ))
    expect(container.querySelector('#body .dv-notice')).toBeNull()
    expect(bell().getAttribute('aria-label')).toBe('Notifications (1)')
    await act(async () => bell().click())
    expect(drawerTitles()).toEqual(['Extraction failed'])
    expect(drawer()?.textContent).toContain('Provider offline.')
    expect(drawer()?.querySelector('.dv-notice')?.getAttribute('role')).toBe('alert')
  })

  it('shows a card only while its condition holds, and only on its own page', async () => {
    const render = (showing: boolean, page: AppPageId = 'react') => root.render(
      <Page page={page}>{showing && <DrawerNotice tone="warning" title="Media Lock">Locked.</DrawerNotice>}</Page>,
    )
    await act(async () => render(true))
    expect(bell().getAttribute('aria-label')).toBe('Notifications (1)')
    await act(async () => render(false))
    expect(bell().getAttribute('aria-label')).toBe('Notifications')
    expect(container.querySelector('.vz-header-notifications-dot')).toBeNull()
    await act(async () => render(true))
    expect(useNotificationStore.getState().pages['react']).toHaveLength(1)
    expect(useNotificationStore.getState().pages['lyric-manager']).toHaveLength(0)
  })

  it('keeps the card\'s own handlers: dismiss and inline buttons work from inside the drawer', async () => {
    const onDismiss = vi.fn()
    const onRetry = vi.fn()
    const parentClick = vi.fn()
    await act(async () => root.render(
      <div onClick={parentClick}>
        <Page page="media-manager">
          <DrawerNotice tone="error" title="Media library unavailable" onDismiss={onDismiss}>
            <button type="button" id="retry" onClick={onRetry}>Retry</button>
          </DrawerNotice>
        </Page>
      </div>,
    ))
    await act(async () => bell().click())
    parentClick.mockClear()
    await act(async () => document.body.querySelector<HTMLButtonElement>('#retry')!.click())
    await act(async () => document.body.querySelector<HTMLButtonElement>('.dv-notice-dismiss')!.click())
    expect(onRetry).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(parentClick).not.toHaveBeenCalled()
  })
})

describe('header Notifications bell', () => {
  it('opens the shared drawer with an empty state and no dot when nothing is showing', async () => {
    await act(async () => root.render(<Page page="react">{null}</Page>))
    expect(container.querySelector('.vz-header-notifications-dot')).toBeNull()
    await act(async () => bell().click())
    expect(drawer()?.getAttribute('aria-label')).toBe('Notifications')
    expect(drawer()?.textContent).toContain('Nothing needs your attention.')
  })

  it('flags warnings and errors with a dot (errors outrank warnings) but not info or success', async () => {
    await act(async () => root.render(<Page page="react"><DrawerNotice tone="info" title="I">i</DrawerNotice><DrawerNotice tone="success" title="S">s</DrawerNotice></Page>))
    expect(container.querySelector('.vz-header-notifications-dot')).toBeNull()
    await act(async () => root.render(<Page page="react"><DrawerNotice tone="warning" title="W">w</DrawerNotice></Page>))
    expect(container.querySelector('.vz-header-notifications-dot')?.getAttribute('data-tone')).toBe('warning')
    expect(bell().getAttribute('data-attention')).toBe('warning')
    await act(async () => root.render(<Page page="react"><DrawerNotice tone="warning" title="W">w</DrawerNotice><DrawerNotice tone="error" title="E">e</DrawerNotice></Page>))
    expect(container.querySelector('.vz-header-notifications-dot')?.getAttribute('data-tone')).toBe('error')
  })

  it('rings the bell when a new warning or error appears, then settles', async () => {
    vi.useFakeTimers()
    await act(async () => root.render(<Page page="react">{null}</Page>))
    expect(bell().dataset.ringing).toBeUndefined()
    await act(async () => root.render(<Page page="react"><DrawerNotice tone="warning" title="W">w</DrawerNotice></Page>))
    expect(bell().dataset.ringing).toBe('true')
    await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
    expect(bell().dataset.ringing).toBeUndefined()
    await act(async () => root.render(<Page page="react"><DrawerNotice tone="info" title="I">i</DrawerNotice><DrawerNotice tone="warning" title="W">w</DrawerNotice></Page>))
    expect(bell().dataset.ringing).toBeUndefined()
  })

  it('closes through the exit animation from the close button, the scrim and Escape', async () => {
    vi.useFakeTimers()
    await act(async () => root.render(<Page page="react">{null}</Page>))
    const finishClosing = async () => {
      expect(document.body.querySelector('.vz-notifications-overlay.is-closing')).not.toBeNull()
      await act(async () => { await vi.advanceTimersByTimeAsync(500) })
      expect(drawer()).toBeNull()
    }
    await act(async () => bell().click())
    await act(async () => document.body.querySelector<HTMLButtonElement>('.vz-notifications-close')!.click())
    await finishClosing()
    await act(async () => bell().click())
    await act(async () => document.body.querySelector<HTMLButtonElement>('.vz-notifications-scrim')!.click())
    await finishClosing()
    await act(async () => bell().click())
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    await finishClosing()
  })
})

describe('notify()', () => {
  it('lists a one-off message in the page drawer, flags the bell until opened, and can be dismissed', async () => {
    await act(async () => root.render(<Page page="media-manager"><div /></Page>))
    expect(bell().getAttribute('aria-label')).toBe('Notifications')

    await act(async () => { notify('media-manager', { tone: 'success', title: 'Media deleted', message: 'Gone.' }) })
    expect(bell().getAttribute('aria-label')).toBe('Notifications (1)')
    expect(bell().querySelector('.vz-header-notifications-dot')?.getAttribute('data-tone')).toBe('success')

    await act(async () => bell().click())
    expect(drawerTitles()).toEqual(['Media deleted'])
    expect(drawer()?.textContent).toContain('Gone.')
    expect(bell().querySelector('.vz-header-notifications-dot')).toBeNull()

    await act(async () => { drawer()?.querySelector<HTMLButtonElement>('.dv-notice button')?.click() })
    expect(drawerTitles()).toEqual([])
    expect(bell().getAttribute('aria-label')).toBe('Notifications')
  })

  it('keeps messages on the page they were sent to', async () => {
    await act(async () => root.render(<Page page="media-manager"><div /></Page>))
    await act(async () => { notify('lyric-manager', { title: 'Elsewhere', message: 'Not here.' }) })
    expect(bell().getAttribute('aria-label')).toBe('Notifications')
  })
})
