// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TemplateAudioDockMockup } from '../react/layoutLab/TemplateAudioDockMockup'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

const dock = () => container.querySelector<HTMLElement>('.az-dock')!
const collapsed = () => dock().dataset.collapsed === 'true'

describe('audio dock: empty space toggles expand / collapse', () => {
  it('has no collapse button', async () => {
    await act(async () => root.render(<TemplateAudioDockMockup />))
    expect(container.querySelector('.vz-dock-density-toggle')).toBeNull()
  })

  it('collapses and expands when empty dock space is clicked', async () => {
    await act(async () => root.render(<TemplateAudioDockMockup />))
    expect(collapsed()).toBe(false)
    await act(async () => dock().click())
    expect(collapsed()).toBe(true)
    await act(async () => container.querySelector<HTMLElement>('.vz-dock-card')!.click())
    expect(collapsed()).toBe(false)
    await act(async () => container.querySelector<HTMLElement>('.vz-dock-help-region')!.click())
    expect(collapsed()).toBe(true)
  })

  it('does not toggle when a control or content inside the dock is clicked', async () => {
    await act(async () => root.render(<TemplateAudioDockMockup />))
    await act(async () => container.querySelector<HTMLElement>('.az-play-btn')!.click())
    await act(async () => container.querySelector<HTMLElement>('.vz-dock-track-title')!.click())
    await act(async () => container.querySelector<HTMLElement>('.vz-dock-play-slot')!.click())
    expect(collapsed()).toBe(false)
  })
})
