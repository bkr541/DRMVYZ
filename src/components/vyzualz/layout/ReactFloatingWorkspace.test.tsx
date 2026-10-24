// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act, useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_VIEWS, FLOATING_APP_VIEWS } from '../appView'
import { ApplicationHeaderControls, ApplicationWorkspaceFrame } from './ApplicationWorkspaceFrame'
import { WorkspaceRail } from './WorkspaceRail'
import reactCss from '../../../styles/reactView.css?raw'

vi.mock('../../../context/AudioEngineContext', () => ({
  useSharedAudio: () => ({ source: 'file' }),
}))

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

/** Exercises the same Phase 02 portal and rail elements used by ReactView,
 * without loading or faking a WebGL renderer. */
function ReactShellFixture({ onStageMount }: { onStageMount: () => void }) {
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [stageFocus, setStageFocus] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  const stageRef = useCallback((node: HTMLCanvasElement | null) => {
    if (node) onStageMount()
  }, [onStageMount])

  return (
    <ApplicationWorkspaceFrame
      appView="react"
      onAppViewChange={() => undefined}
      sidebarCollapsed={sidebarCollapsed}
      onSidebarCollapsedChange={setSidebarCollapsed}
    >
      <main className="vz-main">
        <div className="rv-shell rv-shell--floating" data-stage-focus={stageFocus ? 'true' : undefined}>
          <ApplicationHeaderControls>
            <div className="vz-header" data-react-header-controls>
              <button type="button" aria-label="Layout Lab">Layout Lab</button>
              <button type="button" aria-label="Global Output">Output</button>
            </div>
          </ApplicationHeaderControls>
          <div className="rv-layout" data-left-collapsed={leftCollapsed ? 'true' : undefined} data-right-collapsed={rightCollapsed ? 'true' : undefined}>
            <WorkspaceRail side="left" label="React left rail" collapsed={leftCollapsed} onToggleCollapsed={() => setLeftCollapsed(value => !value)}>
              <div>Engine selection</div>
            </WorkspaceRail>
            <div className="rv-center-col">
              <div className="rv-canvas-wrap">
                <canvas ref={stageRef} data-testid="visual-stage" />
              </div>
              <section className="rv-lower-workspace">
                <button type="button" onClick={() => setStageFocus(value => !value)} aria-label="Stage Focus">Stage Focus</button>
              </section>
            </div>
            <WorkspaceRail side="right" label="React right rail" collapsed={rightCollapsed} onToggleCollapsed={() => setRightCollapsed(value => !value)}>
              <div>Inspector</div>
            </WorkspaceRail>
          </div>
        </div>
      </main>
    </ApplicationWorkspaceFrame>
  )
}

describe('Phase 03 React floating shell', () => {
  it('keeps React opted in after all five workspace migrations', () => {
    expect(FLOATING_APP_VIEWS.react).toBe(true)
    expect(FLOATING_APP_VIEWS.presetManager).toBe(true)
    expect(APP_VIEWS.every(view => FLOATING_APP_VIEWS[view])).toBe(true)
  })

  it('keeps a single brand/header and portals the original feature-owned controls', async () => {
    await act(async () => root.render(<ReactShellFixture onStageMount={() => undefined} />))
    expect(host.querySelectorAll('.fw-app-header .az-logo')).toHaveLength(1)
    expect(host.querySelector('.fw-app-navigation .az-logo')).toBeNull()
    expect(host.querySelectorAll('[data-react-header-controls]')).toHaveLength(1)
    expect(host.querySelectorAll('[aria-label="Layout Lab"]')).toHaveLength(1)
    expect(host.querySelector('.fw-app-header-controls > .vz-header')).not.toBeNull()
    expect(host.querySelector('.rv-shell > .vz-header')).toBeNull()
  })

  it('keeps the canvas DOM node across rail collapse, Stage Focus, and header changes', async () => {
    let mountCount = 0
    await act(async () => root.render(<ReactShellFixture onStageMount={() => { mountCount += 1 }} />))
    const originalStage = host.querySelector('[data-testid="visual-stage"]')
    const layout = host.querySelector('.rv-layout')!
    expect(originalStage).not.toBeNull()
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Collapse left inspector"]')!.click())
    expect(layout.getAttribute('data-left-collapsed')).toBe('true')
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Collapse right inspector"]')!.click())
    expect(layout.getAttribute('data-right-collapsed')).toBe('true')
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Stage Focus"]')!.click())
    expect(host.querySelector('.rv-shell')?.getAttribute('data-stage-focus')).toBe('true')
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Stage Focus"]')!.click())
    expect(host.querySelector('.rv-shell')?.getAttribute('data-stage-focus')).toBeNull()
    await act(async () => host.querySelector<HTMLButtonElement>('.fw-app-header .az-logo')!.click())
    expect(host.querySelector('[data-testid="visual-stage"]')).toBe(originalStage)
    expect(mountCount).toBe(1)
  })

  it('scopes floating rail, stage and temporary dock rules to the React opt-in', () => {
    const scoped = reactCss.slice(reactCss.indexOf('/* Phase 03 — React-only floating composition.'))
    expect(scoped).toContain("[data-workspace-layout='floating'][data-app-workspace='react']")
    expect(scoped).toContain('.rv-canvas-wrap')
    expect(scoped).toContain('.rv-lower-workspace')
    expect(scoped).toContain('> .az-dock.vz-transport-dock')
    expect(scoped).not.toMatch(/!important|\.vz-inspector\s*\{/)
  })
})
