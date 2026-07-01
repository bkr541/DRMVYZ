import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  APP_VIEWS,
  DEFAULT_PERFORMANCE_VIEW,
  isPerformanceAppView,
  resolveAppViewNavigation,
} from './appView'
import type { AppView, PerformanceAppView } from './appView'

describe('shared app-view model', () => {
  it('defines Media Manager in the canonical app-view union', () => {
    expectTypeOf<AppView>().toEqualTypeOf<'react' | 'visualizer' | 'lyrics' | 'media'>()
    expect(APP_VIEWS).toEqual(['react', 'visualizer', 'lyrics', 'media'])
  })

  it('keeps the default and performance-view narrowing strongly typed', () => {
    expectTypeOf(DEFAULT_PERFORMANCE_VIEW).toEqualTypeOf<PerformanceAppView>()
    expect(isPerformanceAppView('react')).toBe(true)
    expect(isPerformanceAppView('visualizer')).toBe(true)
    expect(isPerformanceAppView('media')).toBe(false)
  })
})

describe('Lyric Manager app-view guard', () => {
  it('holds Media Manager as the pending destination when lyrics are unsaved', () => {
    expect(resolveAppViewNavigation('lyrics', 'media', true)).toEqual({
      nextView: 'lyrics',
      pendingView: 'media',
    })
  })

  it('allows Media Manager navigation after lyrics are clean', () => {
    expect(resolveAppViewNavigation('lyrics', 'media', false)).toEqual({
      nextView: 'media',
      pendingView: null,
    })
  })
})
