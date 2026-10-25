// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FontPairingMockups } from '../FontPairingMockups'

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

describe('FontPairingMockups', () => {
  it('renders twenty distinct primary + secondary pairings of the same Design tab', async () => {
    await act(async () => root.render(<FontPairingMockups />))
    const cards = [...container.querySelectorAll<HTMLElement>('[data-font-pairing]')]
    expect(cards).toHaveLength(20)
    expect(new Set(cards.map(card => card.dataset.fontPairing)).size).toBe(20)

    const pairs = cards.map(card => {
      const frame = card.querySelector<HTMLElement>('.llfp-frame')!
      return `${frame.style.getPropertyValue('--az-font')}|${frame.style.getPropertyValue('--az-font-data')}`
    })
    expect(new Set(pairs).size).toBe(20)

    for (const card of cards) {
      expect(card.querySelectorAll('[role="tab"]').length).toBeGreaterThanOrEqual(6)
      expect(card.textContent).toContain('Master Controls')
      expect(card.textContent).toContain('Master Intensity')
      expect(card.textContent).toContain('BPM Sync')
      expect(card.querySelectorAll('input[type="range"]')).toHaveLength(6)
    }
  })

  it('loads the font stylesheet only while mounted', async () => {
    await act(async () => root.render(<FontPairingMockups />))
    const link = document.getElementById('layout-lab-font-pairings') as HTMLLinkElement
    expect(link.href).toContain('fonts.googleapis.com/css2')
    expect(link.href).toContain('family=Quicksand')
    expect(link.href).toContain('family=Source+Serif+4')
    await act(async () => root.render(<></>))
    expect(document.getElementById('layout-lab-font-pairings')).toBeNull()
  })

  it('loads the fonts into the document that renders it, such as the Layout Lab popup window', async () => {
    const frame = document.createElement('iframe')
    document.body.appendChild(frame)
    const frameDocument = frame.contentDocument!
    const frameHost = frameDocument.createElement('div')
    frameDocument.body.appendChild(frameHost)
    const frameRoot = createRoot(frameHost)
    await act(async () => frameRoot.render(<FontPairingMockups />))
    expect(frameDocument.getElementById('layout-lab-font-pairings')).not.toBeNull()
    expect(document.getElementById('layout-lab-font-pairings')).toBeNull()
    await act(async () => frameRoot.unmount())
    expect(frameDocument.getElementById('layout-lab-font-pairings')).toBeNull()
    frame.remove()
  })
})
