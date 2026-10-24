import { describe, expect, it } from 'vitest'
import { APP_VIEWS, FLOATING_APP_VIEWS } from '../appView'
import showCss from '../../../styles/showManager.css?raw'
import reactCss from '../../../styles/reactView.css?raw'
import presetCss from '../../../styles/presetManager.css?raw'
import mediaCss from '../../../styles/mediaManager.css?raw'
import lyricCss from '../../../styles/lyricManager.css?raw'
import floatingCss from '../../../styles/floatingWorkspace.css?raw'
import reactViewSource from '../react/ReactView.tsx?raw'
import showViewSource from '../showManager/ShowManagerView.tsx?raw'

const scope = "[data-workspace-layout='floating'][data-app-workspace='showManager']"

describe('Phase 09 floating workspace hardening', () => {
  it('keeps all five workspaces opted into the same app-frame contract', () => {
    expect(APP_VIEWS).toHaveLength(5)
    expect(APP_VIEWS.every(view => FLOATING_APP_VIEWS[view])).toBe(true)
  })

  it('reuses the shared outer inset, gutter and corner tokens across all five workspaces', () => {
    expect(floatingCss).toContain('--fw-outer-inset: 9px')
    expect(floatingCss).toContain('--fw-region-gap: 11px')
    expect(floatingCss).toContain('--fw-surface-radius: 11px')
    for (const css of [reactCss, presetCss, mediaCss, lyricCss, showCss]) {
      expect(css).toContain('var(--fw-region-gap)')
      expect(css).toContain('var(--fw-surface-radius)')
    }
  })

  it('keeps each performance dock in its own second grid row, never in the old fixed viewport dock', () => {
    const workspaces = [
      { css: reactCss, source: reactViewSource, route: 'react', shell: '.rv-shell--floating' },
      { css: showCss, source: showViewSource, route: 'showManager', shell: '.sm-root' },
    ] as const
    for (const { css, source, route, shell } of workspaces) {
      const selector = `[data-workspace-layout='floating'][data-app-workspace='${route}'] ${shell}`
      const start = css.indexOf(`${selector} {`)
      expect(start, `${route} shell must have its own layout rule`).toBeGreaterThanOrEqual(0)
      const shellRules = css.slice(start).match(/\{([^}]*)\}/)?.[1] ?? ''
      expect(shellRules).toMatch(/display:\s*grid/)
      expect(shellRules).toMatch(/grid-template-rows:\s*minmax\(0, 1fr\) var\(--rv-react-dock-height\)/)
      const dockStart = css.indexOf(`${selector} > .az-dock.vz-transport-dock {`)
      expect(dockStart, `${route} dock must have its own layout rule`).toBeGreaterThanOrEqual(0)
      const dockRules = css.slice(dockStart).match(/\{([^}]*)\}/)?.[1] ?? ''
      expect(dockRules).toMatch(/position:\s*relative/)
      expect(dockRules).toMatch(/grid-row:\s*2/)
      expect(dockRules).not.toMatch(/position:\s*fixed/)
      expect(source.match(/<VyzualzAudioDock\b/g)).toHaveLength(1)
    }
  })

  it('keeps the Show Manager Inspector within the workspace when the app nav is expanded at intermediate widths', () => {
    const fix = showCss.split('/* Phase 09:')[1]
    expect(fix).toBeDefined()
    expect(fix).toContain('@media (min-width: 741px) and (max-width: 912px)')
    const expandedOnly = `${scope}:has(.fw-app-navigation > .az-sidebar:not(.az-sidebar--collapsed))`
    for (const part of [
      '.sm-workspace {',
      '.sm-workspace > .sm-library {',
      '.sm-center {',
      '.sm-workspace > .sm-inspector {',
    ]) expect(fix).toContain(`${expandedOnly} ${part}`)
    expect(fix).toMatch(/grid-template-columns: minmax\(160px, 34%\) minmax\(260px, 1fr\)/)
    expect(fix).toContain('overflow: auto;')
    expect(fix).not.toMatch(/!important|display:\s*none|position:\s*fixed/)
  })
})
