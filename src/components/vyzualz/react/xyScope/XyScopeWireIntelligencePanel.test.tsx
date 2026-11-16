// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NEUTRAL_MOOD } from './XyScopeWireConductor'
import { XyScopeWireIntelligencePanel } from './XyScopeWireIntelligencePanel'
import { publishWireLive, type WireLiveSnapshot } from './XyScopeWireLive'
import { XyScopeWireReactionsEditor } from './XyScopeWireReactionsEditor'
import { DEFAULT_WIRE_RULES, MAX_WIRE_RULES, type WireRule } from './XyScopeWireReactions'
import { WIRE_DEFAULTS } from './XyScopeWireSettings'

let container: HTMLElement
let root: ReturnType<typeof createRoot>

beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container) })
afterEach(() => { act(() => root.unmount()); container.remove(); publishWireLive(null) })

const snapshot = (over: Partial<WireLiveSnapshot> = {}): WireLiveSnapshot => ({
  state: 'READABLE', sceneId: 'breathe', readability: .72, readableFraction: 1, weight: 1, abstract: 0, lastEvent: 'SCENE BREATHE', structure: true, source: 'stereo',
  values: WIRE_DEFAULTS, effective: { ...WIRE_DEFAULTS, chaos: .4 }, mood: { ...NEUTRAL_MOOD, energy: .37, tension: .03, drop: .38, complexity: .54, brightness: .3, sectionType: 'breakdown', structured: true, sectionProgress: .43, phraseIndex: 12, keyIndex: 9, minor: true },
  feel: 'CALM', figure: 'tesseract', auto: true, motion: 1, beatLocked: true, pulse: .2, shock: 0, transition: null, lastReaction: 'Kick → Camera punch', reactionsFired: 7,
  ...over,
})

describe('the Wireframe Performance group (React tab, beside Audio Intelligence)', () => {
  it('says so when nothing is drawing yet', async () => {
    await act(async () => root.render(<XyScopeWireIntelligencePanel />))
    expect(container.textContent).toContain('Appears while the WIREFRAME source is drawing')
  })

  it('shows what was in Master Controls, in the Audio Intelligence style: titled sections, label and value rows, and level bars', async () => {
    await act(async () => root.render(<XyScopeWireIntelligencePanel />))
    await act(async () => publishWireLive(snapshot()))
    const panel = container.querySelector('[data-wire-intelligence]')!
    expect(panel.classList.contains('vz-mi-panel')).toBe(true)
    const titles = [...panel.querySelectorAll('.vz-mi-section-label')].map(el => el.textContent)
    expect(titles).toEqual(['Performance', 'Mood', 'Section', 'Driving', 'Reactions', 'Readability'])
    // The same row classes Audio Intelligence uses.
    expect(panel.querySelectorAll('.vz-mi-kv-row').length).toBeGreaterThan(6)
    expect(panel.querySelectorAll('.vz-mi-kv-label').length).toBeGreaterThan(8)
    expect(panel.querySelectorAll('.vz-mi-row .vz-mi-row-fill').length).toBeGreaterThan(10)
    const text = panel.textContent!
    for (const expected of ['READABLE · BREATHE', 'BEAT-LOCKED', 'LIVE STEREO', 'TRACK SECTIONS', 'CALM', 'TESSERACT', 'BREAKDOWN', 'A MINOR', '37%', 'Kick → Camera punch']) expect(text, expected).toContain(expected)
    expect(text).toContain('Never driven')
  })

  it('reports the figure holding still when the music stops, steady tempo without a beat grid, and drops the Driving section when Auto Performance is off', async () => {
    await act(async () => root.render(<XyScopeWireIntelligencePanel />))
    await act(async () => publishWireLive(snapshot({ motion: 0 })))
    expect(container.textContent).toContain('HOLDING')
    await act(async () => publishWireLive(snapshot({ beatLocked: false, auto: false, structure: false, source: 'shared' })))
    const text = container.textContent!
    expect(text).toContain('STEADY TEMPO'); expect(text).toContain('ONSETS ONLY'); expect(text).toContain('SHARED ANALYSIS')
    expect([...container.querySelectorAll('.vz-mi-section-label')].map(el => el.textContent)).not.toContain('Driving')
  })

  it('never invents a section, phrase or key for a live microphone', async () => {
    await act(async () => root.render(<XyScopeWireIntelligencePanel />))
    await act(async () => publishWireLive(snapshot({ structure: false, mood: { ...NEUTRAL_MOOD, energy: .5 } })))
    const text = container.textContent!
    expect(text).toContain('UNKNOWN')
    expect(text).toContain('NONE')
  })
})

describe('the Reactions editor', () => {
  function Harness({ initial }: { initial: WireRule[] }) {
    const [rules, setRules] = useState(initial)
    return <><XyScopeWireReactionsEditor rules={rules} onChange={setRules} /><output data-count>{rules.length}</output><output data-first>{rules[0]?.id ?? ''}</output></>
  }
  const count = () => Number(container.querySelector('[data-count]')!.textContent)
  const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.includes(text))!

  it('lists every rule as its own group, with the standard rows for when, do, amount, how often and enabled', async () => {
    await act(async () => root.render(<Harness initial={DEFAULT_WIRE_RULES.map(r => ({ ...r }))} />))
    expect(container.querySelectorAll('[data-wire-rule]')).toHaveLength(DEFAULT_WIRE_RULES.length)
    // Rules start collapsed; open the first to see its controls.
    const toggle = [...container.querySelectorAll<HTMLElement>('button, [role="button"]')].find(el => el.textContent?.includes('Kick → Camera punch'))
    expect(toggle).toBeTruthy()
    const first = container.querySelector('[data-wire-rule="r-kick-punch"]')!
    for (const part of ['trigger', 'reaction', 'amount', 'every', 'enabled']) expect(first.querySelector(`#xyscope-wire-rule-r-kick-punch-${part}`), part).not.toBeNull()
  })

  it('adds a reaction (up to the limit), removes one, and resets to the defaults', async () => {
    await act(async () => root.render(<Harness initial={[]} />))
    expect(count()).toBe(0)
    await act(async () => button('Add Reaction').click())
    await act(async () => button('Add Reaction').click())
    expect(count()).toBe(2)
    await act(async () => button('Remove Reaction').click())
    expect(count()).toBe(1)
    for (let i = 0; i < MAX_WIRE_RULES + 4; i++) await act(async () => button('Add Reaction').click())
    expect(count()).toBe(MAX_WIRE_RULES)
    await act(async () => button('Reset Reactions').click())
    expect(count()).toBe(DEFAULT_WIRE_RULES.length)
    expect(container.querySelector('[data-first]')!.textContent).toBe('r-kick-punch')
  })
})
