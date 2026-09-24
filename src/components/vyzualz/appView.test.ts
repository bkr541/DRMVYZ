import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  APP_VIEWS,
  DEFAULT_PERFORMANCE_VIEW,
  isPerformanceAppView,
  resolveAppViewNavigation,
} from './appView'
import type { AppView, PerformanceAppView } from './appView'

describe('shared app-view model', () => {
  it('defines only the current production workspaces in the canonical app-view union', () => {
    expectTypeOf<AppView>().toEqualTypeOf<'react' | 'showManager' | 'lyrics' | 'media'>()
    expect(APP_VIEWS).toEqual(['react', 'showManager', 'lyrics', 'media'])
    expect(APP_VIEWS.join(',')).not.toContain('visualizer')
  })

  it('keeps the default and performance-view narrowing strongly typed', () => {
    expectTypeOf(DEFAULT_PERFORMANCE_VIEW).toEqualTypeOf<PerformanceAppView>()
    expect(DEFAULT_PERFORMANCE_VIEW).toBe('react')
    expect(isPerformanceAppView('react')).toBe(true)
    expect(isPerformanceAppView('showManager')).toBe(true)
    expect(isPerformanceAppView('media')).toBe(false)
  })
})

describe('Lyric Manager app-view guard', () => {
  it('holds Media Manager as the pending destination when lyrics are unsaved', () => {
    expect(resolveAppViewNavigation('lyrics', 'media', { lyrics: true })).toEqual({
      nextView: 'lyrics',
      pendingView: 'media',
    })
  })

  it('allows Media Manager navigation after lyrics are clean', () => {
    expect(resolveAppViewNavigation('lyrics', 'media', { lyrics: false })).toEqual({
      nextView: 'media',
      pendingView: null,
    })
  })
})

describe('Media Manager app-view guard', () => {
  it('holds the requested destination while media edits are unsaved', () => {
    expect(resolveAppViewNavigation('media', 'react', { media: true })).toEqual({
      nextView: 'media',
      pendingView: 'react',
    })
    expect(resolveAppViewNavigation('media', 'lyrics', { media: true })).toEqual({
      nextView: 'media',
      pendingView: 'lyrics',
    })
  })

  it('allows navigation once media edits are clean', () => {
    expect(resolveAppViewNavigation('media', 'react', { media: false })).toEqual({
      nextView: 'react',
      pendingView: null,
    })
  })

  it('only the current view can block: unsaved lyrics do not stop navigation away from Media Manager', () => {
    expect(resolveAppViewNavigation('media', 'react', { lyrics: true })).toEqual({
      nextView: 'react',
      pendingView: null,
    })
    expect(resolveAppViewNavigation('lyrics', 'react', { media: true })).toEqual({
      nextView: 'react',
      pendingView: null,
    })
  })

  it('never blocks a request for the view that is already open', () => {
    expect(resolveAppViewNavigation('media', 'media', { media: true })).toEqual({
      nextView: 'media',
      pendingView: null,
    })
  })
})
