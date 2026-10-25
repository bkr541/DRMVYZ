// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DualRailCollapsible } from '../DualRailCollapsible'
import { GENERIC_GROUP_ICON, groupHeaderIconKind } from '../groupHeaderIcon'

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('parent group header icons', () => {
  it('gives every parent group an icon and no nested group one, at any depth', async () => {
    await act(async () => root.render(
      <>
        <DualRailCollapsible label="Cue List">
          <DualRailCollapsible label="Pattern">
            <DualRailCollapsible label="Deeper"><span>body</span></DualRailCollapsible>
          </DualRailCollapsible>
        </DualRailCollapsible>
        <DualRailCollapsible label="Overrides"><span>body</span></DualRailCollapsible>
      </>,
    ))
    const headers = [...container.querySelectorAll<HTMLElement>('.drc-header')]
    expect(headers.map(header => [header.textContent, header.querySelectorAll('.drc-header-icon svg').length])).toEqual([
      ['Cue List', 1],
      ['Pattern', 0],
      ['Deeper', 0],
      ['Overrides', 1],
    ])
    expect(container.querySelector('.drc-header-icon')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('lets a parent pass its own icon or suppress it with false', async () => {
    await act(async () => root.render(
      <>
        <DualRailCollapsible label="Custom" icon={<i data-testid="mine" />}><span /></DualRailCollapsible>
        <DualRailCollapsible label="Plain" icon={false}><span /></DualRailCollapsible>
      </>,
    ))
    const [custom, plain] = [...container.querySelectorAll<HTMLElement>('.drc-header')]
    expect(custom!.querySelector('[data-testid="mine"]')).not.toBeNull()
    expect(custom!.querySelector('svg:not(.drc-arrow svg)')).toBeNull()
    expect(plain!.querySelector('.drc-header-icon')).toBeNull()
  })

  it('chooses an icon from the label and falls back to the generic group glyph', () => {
    expect(groupHeaderIconKind('Master Controls')).toBe('sliders')
    expect(groupHeaderIconKind('Palette')).toBe('colorPalette')
    expect(groupHeaderIconKind('Effects')).toBe('wand')
    expect(groupHeaderIconKind('Design')).toBe('paintBrush')
    expect(groupHeaderIconKind('Audio Reactivity')).toBe('waveform')
    expect(groupHeaderIconKind('Track Timeline')).toBe('timeline')
    expect(groupHeaderIconKind('Cue List')).toBe('cue')
    expect(groupHeaderIconKind('Document Info')).toBe('info')
    expect(groupHeaderIconKind('Advanced')).toBe('settings')
    expect(groupHeaderIconKind('Overrides')).toBe('sliders')
    expect(groupHeaderIconKind('Zebra')).toBe(GENERIC_GROUP_ICON)
    expect(groupHeaderIconKind(<span>node</span>)).toBe(GENERIC_GROUP_ICON)
  })
})
