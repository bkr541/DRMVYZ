export const APP_VIEWS = ['react', 'showManager', 'lyrics', 'media'] as const

export type AppView = (typeof APP_VIEWS)[number]
export type PerformanceAppView = Extract<AppView, 'react' | 'showManager'>

export const DEFAULT_PERFORMANCE_VIEW: PerformanceAppView = 'react'

export const APP_VIEW_LABELS: Readonly<Record<AppView, string>> = {
  react: 'React',
  showManager: 'Show Manager',
  lyrics: 'Lyric Manager',
  media: 'Media Manager',
}

export function isPerformanceAppView(view: AppView): view is PerformanceAppView {
  return view === 'react' || view === 'showManager'
}

export interface AppViewNavigationDecision {
  nextView: AppView
  pendingView: AppView | null
}

/**
 * Which views currently hold unsaved work. Each feature reports only its own
 * flag, so Lyric Manager and Media Manager can both block navigation without
 * knowing anything about each other.
 */
export type AppViewUnsavedState = Readonly<Partial<Record<AppView, boolean>>>

export function resolveAppViewNavigation(
  currentView: AppView,
  requestedView: AppView,
  unsaved: AppViewUnsavedState,
): AppViewNavigationDecision {
  if (requestedView !== currentView && unsaved[currentView] === true) {
    return { nextView: currentView, pendingView: requestedView }
  }

  return { nextView: requestedView, pendingView: null }
}
