// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FloatingWorkspaceFrame, WorkspaceRegion, WorkspaceSurface } from './FloatingWorkspace'
import { WorkspaceShell } from './WorkspaceShell'
import floatingCss from '../../../styles/floatingWorkspace.css?raw'

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

function render(node: React.ReactElement) {
  return act(async () => root.render(node))
}

describe('floating-workspace visual contract', () => {
  it('requires explicit frame opt-in and preserves slot names, attributes, and children', async () => {
    await render(
      <FloatingWorkspaceFrame aria-label="Workspace" className="custom-frame">
        <WorkspaceRegion slot="header" aria-label="Header" className="custom-region">
          <WorkspaceSurface className="custom-surface" data-testid="surface">
            Header content
          </WorkspaceSurface>
        </WorkspaceRegion>
        <WorkspaceRegion slot="stage"><div data-testid="live-stage" /></WorkspaceRegion>
      </FloatingWorkspaceFrame>,
    )

    const frame = host.querySelector('.fw-workspace')!
    expect(frame.getAttribute('data-workspace-layout')).toBe('floating')
    expect(frame.classList.contains('custom-frame')).toBe(true)
    expect(frame.getAttribute('aria-label')).toBe('Workspace')
    expect(frame.querySelector('.fw-region[data-workspace-slot="header"]')?.getAttribute('aria-label')).toBe('Header')
    expect(frame.querySelector('.fw-region.custom-region > .fw-surface.custom-surface')?.textContent).toBe('Header content')
    expect(frame.querySelector('.fw-region[data-workspace-slot="stage"] [data-testid="live-stage"]')).not.toBeNull()
  })

  it('does not opt legacy WorkspaceShell into the floating layout', async () => {
    await render(<WorkspaceShell left={null} center={null} right={null} />)
    expect(host.querySelector('[data-workspace-layout="floating"]')).toBeNull()
    expect(host.querySelector('.ws-shell-body.vz-content')).not.toBeNull()
  })

  it('keeps every floating visual CSS selector behind the opt-in ancestor', () => {
    const css = floatingCss.replace(/\/\*[\s\S]*?\*\//g, '')
    const selectors = [...css.matchAll(/([^{}]+)\{/g)].map(match => match[1].trim())
    expect(selectors.length).toBeGreaterThan(4)
    for (const selector of selectors) {
      expect(selector.startsWith("[data-workspace-layout='floating']")).toBe(true)
    }
    expect(css).toContain('--fw-compact-nav-width: 72px')
    expect(css).toContain('--fw-header-height: 60px')
    expect(css).not.toMatch(/overflow\s*:\s*hidden|position\s*:\s*relative|!important/)
  })
})
