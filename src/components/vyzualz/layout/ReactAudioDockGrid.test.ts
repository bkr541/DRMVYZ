import { describe, expect, it } from 'vitest'
import reactCss from '../../../styles/reactView.css?raw'
import reactViewSource from '../react/ReactView.tsx?raw'
import dockSource from '../shared/VyzualzAudioDock.tsx?raw'

const scope = "[data-workspace-layout='floating'][data-app-workspace='react']"
const phase04 = reactCss.slice(reactCss.indexOf('/* Phase 04 — The original audio dock'))

function declarations(selector: string): string {
  const start = phase04.indexOf(`${selector} {`)
  expect(start, `Missing Phase 04 selector: ${selector}`).toBeGreaterThanOrEqual(0)
  return phase04.slice(start).match(/\{([^}]*)\}/)?.[1] ?? ''
}

describe('Phase 04 React audio dock layout contract', () => {
  it('keeps one mounted dock after the stage grid and inside ReactView', () => {
    const layoutIndex = reactViewSource.lastIndexOf('className="rv-layout"')
    const dockIndex = reactViewSource.lastIndexOf('<VyzualzAudioDock')
    expect(layoutIndex).toBeGreaterThan(0)
    expect(dockIndex).toBeGreaterThan(layoutIndex)
    expect(reactViewSource.match(/<VyzualzAudioDock\b/g)).toHaveLength(1)
    expect(reactViewSource).toContain('compact={stageFocus}')
    expect(reactViewSource).toContain('expandable')
    expect(reactViewSource).toContain('waveformAppearance="deck"')
  })

  it('places the workspace and dock in true grid rows with no viewport coordinate shim', () => {
    const shell = reactCss.match(/\[data-workspace-layout='floating'\]\[data-app-workspace='react'\] \.rv-shell--floating \{([^}]*)\}/)?.[1] ?? ''
    expect(shell).toMatch(/display:\s*grid;/)
    expect(shell).toMatch(/grid-template-rows:\s*minmax\(0, 1fr\) var\(--rv-react-dock-height\);/)
    expect(shell).toMatch(/gap:\s*var\(--fw-region-gap\);/)
    expect(shell).toMatch(/padding-bottom:\s*0;/)
    const dock = declarations(`${scope} .rv-shell--floating > .az-dock.vz-transport-dock`)
    expect(dock).toMatch(/position:\s*relative;/)
    expect(dock).toMatch(/grid-row:\s*2;/)
    expect(dock).toMatch(/left:\s*auto;/)
    expect(dock).toMatch(/right:\s*auto;/)
    expect(dock).toMatch(/bottom:\s*auto;/)
    expect(dock).toMatch(/width:\s*100%;/)
    expect(dock).not.toMatch(/position:\s*fixed|--vz-sidebar-width/)
    expect(dock).toContain('min(max(var(--rv-floating-rail-width), 260px), 34%)')
  })

  it('tracks persisted collapse and Stage Focus without replacing the dock or canvas', () => {
    expect(reactCss).toMatch(/\.rv-shell:has\(> \.vz-transport-dock--collapsed\)\s*\{\s*--rv-react-dock-height:\s*72px;/)
    expect(dockSource).toContain("'drmvyz.audioDock.collapsed.v1'")
    expect(dockSource).toContain('const dockCollapsed = compact || (expandable && collapsedByUser)')
    expect(reactViewSource).toContain('data-stage-focus={stageFocus')
    expect(declarations(`${scope} .rv-shell--floating > .az-dock.vz-transport-dock`)).toMatch(/height:\s*var\(--rv-react-dock-height\);/)
  })

  it('draws two separate surfaces without introducing any new click target or changing Show Manager', () => {
    expect(declarations(`${scope} .rv-shell--floating > .az-dock.vz-transport-dock::before`)).toMatch(/grid-column:\s*1 \/ span 2;/)
    expect(declarations(`${scope} .rv-shell--floating > .az-dock.vz-transport-dock::before`)).toMatch(/pointer-events:\s*none;/)
    expect(declarations(`${scope} .rv-shell--floating > .vz-transport-dock > .vz-dock-region:last-child > .vz-dock-card`)).toContain('border-radius: var(--fw-surface-radius)')
    expect(phase04).not.toMatch(/!important|\[data-app-workspace='showManager'\]/)
    expect(reactViewSource).toContain('lowerReservedAction={(')
  })
})
