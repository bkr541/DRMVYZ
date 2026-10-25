import { describe, expect, it } from 'vitest'
import { FLOATING_APP_VIEWS } from '../../components/vyzualz/appView'
import lyricCss from '../../styles/lyricManager.css?raw'
import floatingCss from '../../styles/floatingWorkspace.css?raw'
import { LYRIC_LAYOUT_BREAKPOINTS, lyricLayoutDrawers, resolveLyricLayoutMode } from './lyricLayoutMode'

const scope = "[data-workspace-layout='floating'][data-app-workspace='lyrics']"

describe('Phase 07 Lyric Manager floating composition', () => {
  it('keeps Lyric Manager opted in alongside the other migrated workspaces', () => {
    expect(FLOATING_APP_VIEWS).toEqual({
      react: true,
      presetManager: true,
      showManager: true,
      lyrics: true,
      media: true,
    })
  })

  it('keeps separate left surfaces, independent center windows and one right inspector', () => {
    const scoped = lyricCss.slice(lyricCss.indexOf('/* Phase 07: Lyric Manager'))
    expect(scoped).toContain(`${scope} .lmv-workspace-shell`)
    for (const surface of [
      '.lmv-track-workspace', '.lmv-preview-stage',
      '.lmv-track-meta-header', '.lmv-track-timeline-window',
      '.lmv-lyric-cues-window', '.lmv-right-rail',
    ]) expect(scoped).toContain(surface)
    expect(scoped).not.toMatch(/!important|\.vz-inspector\s*\{/)
    expect(floatingCss).toContain('--fw-region-gap: 11px')
  })

  it('keeps width thresholds measured at the manager, accounting for floating app chrome', () => {
    // The current outer frame reserves two 9px insets, a 72px collapsed
    // navigation rail and an 11px region gap before measuring .lmv-root.
    const managerWidth = (viewport: number) => viewport - 2 * 9 - 72 - 11
    expect(resolveLyricLayoutMode(managerWidth(1588))).toBe('standard')
    expect(resolveLyricLayoutMode(managerWidth(954))).toBe('narrow')
    for (const [boundary, expected, below] of [
      [LYRIC_LAYOUT_BREAKPOINTS.wide, 'wide', 'standard'],
      [LYRIC_LAYOUT_BREAKPOINTS.standard, 'standard', 'laptop'],
      [LYRIC_LAYOUT_BREAKPOINTS.laptop, 'laptop', 'narrow'],
    ] as const) {
      expect(resolveLyricLayoutMode(boundary)).toBe(expected)
      expect(resolveLyricLayoutMode(boundary - 1)).toBe(below)
    }
    expect(lyricLayoutDrawers(resolveLyricLayoutMode(managerWidth(954)))).toEqual({ left: true, right: true })
  })
})
