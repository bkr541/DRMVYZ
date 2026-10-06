import { createContext, useContext, useMemo } from 'react'
import { create } from 'zustand'
import type { AppPageId } from './pageActivityStore'
import type { NoticeCardTone } from '../components/vyzualz/react/controls/NoticeCard'

/**
 * Registry behind each page header's Notifications bell. A `DrawerNotice` (see shared/DrawerNotice.tsx) registers a
 * lightweight entry here for as long as it is mounted, which is exactly as long as the condition that used to show its
 * inline NoticeCard holds. The card's content is NOT stored: the open drawer hands each entry a slot element and the
 * notice portals its own NoticeCard into it, so handlers, state and context stay with the code that owns the notice.
 */
export interface NotificationEntry {
  /** Unique per DrawerNotice instance. */
  key: string
  tone: NoticeCardTone
}

/**
 * A one-off message ("Media item deleted") pushed by code with `notify`. Unlike a DrawerNotice it is not tied to a mounted
 * component: it stays in the page's Notifications drawer until the user dismisses it, and the bell flags it as unread
 * until the drawer is opened.
 */
export interface NotificationEvent {
  id: string
  tone: NoticeCardTone
  title: string
  message: string
  unread: boolean
}

export interface NotifyOptions {
  tone?: NoticeCardTone
  title: string
  message: string
}

const MAX_EVENTS_PER_PAGE = 20
const EMPTY_EVENTS: readonly NotificationEvent[] = Object.freeze([])
const EMPTY_EVENT_PAGES: Readonly<Record<AppPageId, readonly NotificationEvent[]>> = Object.freeze({
  'react': EMPTY_EVENTS,
  'show-manager': EMPTY_EVENTS,
  'media-manager': EMPTY_EVENTS,
  'lyric-manager': EMPTY_EVENTS,
})

interface NotificationState {
  /** Newest first. */
  events: Readonly<Record<AppPageId, readonly NotificationEvent[]>>
  pushEvent: (page: AppPageId, event: NotifyOptions) => string
  dismissEvent: (page: AppPageId, id: string) => void
  markEventsRead: (page: AppPageId) => void
  pages: Readonly<Record<AppPageId, readonly NotificationEntry[]>>
  /** The drawer's slot element for each entry while the drawer is open. */
  slots: Readonly<Record<string, HTMLElement>>
  register: (page: AppPageId, key: string, tone: NoticeCardTone) => void
  unregister: (page: AppPageId, key: string) => void
  setSlot: (key: string, element: HTMLElement | null) => void
}

const EMPTY: readonly NotificationEntry[] = Object.freeze([])
const EMPTY_PAGES: NotificationState['pages'] = Object.freeze({
  'react': EMPTY,
  'show-manager': EMPTY,
  'media-manager': EMPTY,
  'lyric-manager': EMPTY,
})

let nextEventId = 0

export const useNotificationStore = create<NotificationState>(set => ({
  events: EMPTY_EVENT_PAGES,
  pushEvent: (page, { tone = 'info', title, message }) => {
    const id = `event-${++nextEventId}`
    set(state => ({
      events: { ...state.events, [page]: [{ id, tone, title, message, unread: true }, ...state.events[page]].slice(0, MAX_EVENTS_PER_PAGE) },
    }))
    return id
  },
  dismissEvent: (page, id) => set(state => {
    if (!state.events[page].some(event => event.id === id)) return state
    const next = state.events[page].filter(event => event.id !== id)
    return { events: { ...state.events, [page]: next.length ? next : EMPTY_EVENTS } }
  }),
  markEventsRead: page => set(state => {
    if (!state.events[page].some(event => event.unread)) return state
    return { events: { ...state.events, [page]: state.events[page].map(event => event.unread ? { ...event, unread: false } : event) } }
  }),
  pages: EMPTY_PAGES,
  slots: {},
  register: (page, key, tone) => set(state => {
    const current = state.pages[page]
    const existing = current.find(entry => entry.key === key)
    if (existing?.tone === tone) return state
    const next = existing ? current.map(entry => entry.key === key ? { key, tone } : entry) : [...current, { key, tone }]
    return { pages: { ...state.pages, [page]: next } }
  }),
  unregister: (page, key) => set(state => {
    const current = state.pages[page]
    if (!current.some(entry => entry.key === key)) return state
    const next = current.filter(entry => entry.key !== key)
    const { [key]: _slot, ...slots } = state.slots
    return { pages: { ...state.pages, [page]: next.length ? next : EMPTY }, slots }
  }),
  setSlot: (key, element) => set(state => {
    if (element) return state.slots[key] === element ? state : { slots: { ...state.slots, [key]: element } }
    if (!(key in state.slots)) return state
    const { [key]: _slot, ...slots } = state.slots
    return { slots }
  }),
}))

/** Pushes a one-off message into `page`'s Notifications drawer (the header bell). Safe to call from anywhere, React or not. */
export function notify(page: AppPageId, options: NotifyOptions): string {
  return useNotificationStore.getState().pushEvent(page, options)
}

export function usePageNotificationEvents(page: AppPageId): readonly NotificationEvent[] {
  return useNotificationStore(state => state.events[page])
}

/** Every notice currently showing on `page`, in the order they appeared. */
export function usePageNotificationEntries(page: AppPageId): readonly NotificationEntry[] {
  return useNotificationStore(state => state.pages[page])
}

/**
 * Which app page the surrounding UI belongs to. Each page view is wrapped in a provider; a DrawerNotice rendered
 * outside any page (a component on its own, a test) simply shows its NoticeCard inline as before.
 */
export const NotificationPageContext = createContext<AppPageId | null>(null)
export const NotificationPageProvider = NotificationPageContext.Provider
export function useNotificationPage(): AppPageId | null {
  return useContext(NotificationPageContext)
}

/** Worst tone among a page's notices, for the bell's dot: errors outrank warnings; info and success do not flag. */
export function useNotificationAttention(page: AppPageId): 'error' | 'warning' | null {
  const entries = usePageNotificationEntries(page)
  return useMemo(
    () => entries.some(entry => entry.tone === 'error') ? 'error' : entries.some(entry => entry.tone === 'warning') ? 'warning' : null,
    [entries],
  )
}
