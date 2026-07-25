// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useReactStore } from '../../../../../stores/reactStore'
import { PixGridAuthoringPanel } from '../PixGridAuthoringPanel'
import { PixGridDesignPanel } from '../PixGridDesignPanel'
import reactViewCss from '../../../../../styles/reactView.css?raw'

let root: Root
let host: HTMLDivElement

beforeEach(() => {
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('pixGrid')
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('PixGrid panel consistency', () => {
  it('removes technical matrix status from above Edit PixGrid', () => {
    act(() => root.render(<PixGridAuthoringPanel />))
    const editButton = [...host.querySelectorAll('button')].find(button => button.textContent === 'Edit PixGrid')!
    expect(editButton).toBeDefined()
    expect(host.querySelector('.rv-engine-status-grid')).toBeNull()
    expect(editButton.previousElementSibling).toBeNull()
    expect(editButton.nextElementSibling?.textContent).toContain('Changes save automatically')
  })

  it('retains the shared right-panel horizontal padding contract', () => {
    const pixGridBlock = reactViewCss.match(/\.rv-pix-grid-design-panel\s*\{([^}]*)\}/)?.[1] ?? ''
    const sharedBlock = reactViewCss.match(/\.rv-ctrl-group\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(pixGridBlock).not.toContain('padding-inline: 0')
    expect(sharedBlock).toContain('padding: 7px 11px 10px')
  })

  it('uses the standard control group and wrapping workspace subtabs', () => {
    act(() => root.render(<PixGridDesignPanel />))
    const panel = host.querySelector('.rv-pix-grid-design-panel')!
    const tabs = host.querySelector('[role="tablist"][aria-label="PixGrid design sections"]')!
    expect(panel.classList.contains('rv-ctrl-group')).toBe(true)
    expect(tabs.classList.contains('rv-right-subtabs')).toBe(true)
    expect(tabs.classList.contains('rv-right-subtabs--wrap')).toBe(true)
    expect(tabs.querySelectorAll('[role="tab"]')).toHaveLength(5)
    expect(host.querySelector('.rv-ctrl-action-row')).not.toBeNull()
    expect(host.textContent).toContain('Active Scene')
    expect(host.textContent).toContain('Edit Target')
  })
})
