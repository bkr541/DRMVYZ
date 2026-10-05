import { useEffect, useMemo } from 'react'
import { create } from 'zustand'

/** The app pages whose header carries the activity spinner (see VyzualzHeaderActions). */
export type AppPageId = 'react' | 'show-manager' | 'media-manager' | 'lyric-manager'

/** One entry per active source, keyed `${owner}:${sourceId}`; the value is the label shown in the spinner tooltip. */
type PageSources = Readonly<Record<string, string>>

interface PageActivityState {
  pages: Readonly<Record<AppPageId, PageSources>>
  replaceOwnerSources: (page: AppPageId, owner: string, sources: Readonly<Record<string, string>>) => void
}

const EMPTY: PageSources = Object.freeze({})
const EMPTY_PAGES: PageActivityState['pages'] = Object.freeze({
  'react': EMPTY,
  'show-manager': EMPTY,
  'media-manager': EMPTY,
  'lyric-manager': EMPTY,
})

export const usePageActivityStore = create<PageActivityState>(set => ({
  pages: EMPTY_PAGES,
  replaceOwnerSources: (page, owner, sources) => set(state => {
    const prefix = `${owner}:`
    const kept = Object.fromEntries(Object.entries(state.pages[page]).filter(([key]) => !key.startsWith(prefix)))
    const next = { ...kept, ...Object.fromEntries(Object.entries(sources).map(([id, label]) => [`${prefix}${id}`, label])) }
    const unchanged = Object.keys(next).length === Object.keys(state.pages[page]).length
      && Object.entries(next).every(([key, label]) => state.pages[page][key] === label)
    if (unchanged) return state
    return { pages: { ...state.pages, [page]: Object.keys(next).length ? next : EMPTY } }
  }),
}))

/** Labels of everything currently loading on `page`, in registration order. Empty when the page is idle. */
export function usePageActivityLabels(page: AppPageId): string[] {
  const sources = usePageActivityStore(state => state.pages[page])
  return useMemo(() => [...new Set(Object.values(sources))], [sources])
}

/**
 * Registers a page's real loading work with the header spinner. Pass a record of
 * `sourceId -> label` where a falsy value means "not loading"; the page counts as busy
 * while any entry has a label. `owner` namespaces the hook so several hooks on one page
 * never clear each other, and everything it registered is removed on unmount.
 */
export function usePageActivities(
  page: AppPageId,
  owner: string,
  sources: Readonly<Record<string, string | false | null | undefined>>,
): void {
  const active = Object.entries(sources).filter((entry): entry is [string, string] => Boolean(entry[1]))
  const key = JSON.stringify(active)
  useEffect(() => {
    usePageActivityStore.getState().replaceOwnerSources(page, owner, Object.fromEntries(JSON.parse(key) as Array<[string, string]>))
  }, [page, owner, key])
  useEffect(() => () => usePageActivityStore.getState().replaceOwnerSources(page, owner, {}), [page, owner])
}
