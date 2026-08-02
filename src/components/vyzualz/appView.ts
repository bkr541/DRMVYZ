export const APP_VIEWS = ['react', 'visualizer', 'showManager', 'lyrics', 'media'] as const

export type AppView = (typeof APP_VIEWS)[number]
export type PerformanceAppView = Extract<AppView, 'react' | 'visualizer' | 'showManager'>

export const DEFAULT_PERFORMANCE_VIEW: PerformanceAppView = 'react'

export const APP_VIEW_LABELS: Readonly<Record<AppView, string>> = {
  react: 'React',
  visualizer: 'Visualizer',
  showManager: 'Show Manager',
  lyrics: 'Lyric Manager',
  media: 'Media Manager',
}

export function isPerformanceAppView(view: AppView): view is PerformanceAppView {
  return view === 'react' || view === 'visualizer' || view === 'showManager'
}

export interface AppViewNavigationDecision {
  nextView: AppView
  pendingView: AppView | null
}

export function resolveAppViewNavigation(
  currentView: AppView,
  requestedView: AppView,
  hasUnsavedLyrics: boolean,
): AppViewNavigationDecision {
  if (currentView === 'lyrics' && requestedView !== 'lyrics' && hasUnsavedLyrics) {
    return { nextView: currentView, pendingView: requestedView }
  }

  return { nextView: requestedView, pendingView: null }
}
