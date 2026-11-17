// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Cinema2SchemaControl } from '../Cinema2InspectorPanel'
import { findCinema2PolicyControls, Cinema2LivePolicyProvider, Cinema2LiveValuesProvider, resolveCinema2LivePolicy, resolveCinema2LiveValues } from '../Cinema2LiveValues'
import { CINEMA2_DEPTH_PRESET_MANIFEST } from '../../cinema2/presets/Cinema2DepthPreset'
import { SliderRow } from '../ReactControlRows'
import type { Cinema2InspectorControlModel } from '../../cinema2/parameters/Cinema2InspectorModel'

let container: HTMLElement
let root: ReturnType<typeof createRoot>
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container) })
afterEach(() => { act(() => root.unmount()); container.remove() })

const control = (id: string, value: number): Readonly<Cinema2InspectorControlModel> => ({
  definition: { id, label: 'Rate', type: 'float', min: 0, max: 4, step: .05, defaultValue: 1.1, description: 'How fast.' },
  value, enabled: true, disabledReason: null,
}) as unknown as Readonly<Cinema2InspectorControlModel>

describe('the slider\'s live value', () => {
  it('looks exactly as before without a live value: no marker, no second readout, no wrapper', async () => {
    await act(async () => root.render(<SliderRow label="Rate" value={1.1} min={0} max={4} step={.05} onChange={() => {}} />))
    expect(container.querySelector('[data-live-mark]')).toBeNull()
    expect(container.querySelector('[data-live-value]')).toBeNull()
    expect(container.querySelector('.rv-ctrl-slider-wrap')).toBeNull()
    expect(container.querySelector('.rv-ctrl-val')!.textContent).toBe('1.10')
    expect(container.querySelector<HTMLInputElement>('input[type="range"]')!.value).toBe('1.1')
  })

  it('shows what the music is driving it to beside the saved value and as a marker on the track, and leaves the slider on the saved value', async () => {
    await act(async () => root.render(<SliderRow label="Rate" value={1.1} min={0} max={4} step={.05} liveValue={2} onChange={() => {}} />))
    expect(container.querySelector('[data-live-value]')!.textContent).toBe('2.00 →')
    expect(container.querySelector('.rv-ctrl-val')!.textContent).toBe('2.00 →1.10')
    expect((container.querySelector('[data-live-mark]') as HTMLElement).style.left).toBe('50%')
    expect(container.querySelector<HTMLInputElement>('input[type="range"]')!.value).toBe('1.1')
  })

  it('formats the live value like the saved one, and keeps the marker on the track when it is out of range', async () => {
    await act(async () => root.render(<SliderRow label="Bloom" value={.28} min={0} max={1} step={.01} liveValue={5} onChange={() => {}} />))
    expect(container.querySelector('[data-live-value]')!.textContent).toBe('500% →')
    expect((container.querySelector('[data-live-mark]') as HTMLElement).style.left).toBe('100%')
  })

  it('is still the saved value that is edited', async () => {
    let edited = 0
    await act(async () => root.render(<SliderRow label="Rate" value={1.1} min={0} max={4} step={.05} liveValue={2} onChange={v => { edited = v }} />))
    const input = container.querySelector<HTMLInputElement>('input[type="range"]')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '3'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(edited).toBe(3)
  })
})

describe('the inspector control reads the live value from the panel', () => {
  it('passes the live value for its own parameter to the slider, and only for it', async () => {
    await act(async () => root.render(
      <Cinema2LiveValuesProvider value={new Map([['depth-rate', 1.9]])}>
        <Cinema2SchemaControl control={control('depth-rate', 1.1)} onChange={() => {}} onTrigger={() => {}} />
        <Cinema2SchemaControl control={control('depth-spill', .28)} onChange={() => {}} onTrigger={() => {}} />
      </Cinema2LiveValuesProvider>,
    ))
    const rows = [...container.querySelectorAll('[data-cinema2-control-id]')]
    expect(rows[0].querySelector('[data-live-value]')!.textContent).toBe('1.90 →')
    expect(rows[1].querySelector('[data-live-value]')).toBeNull()
  })

  it('shows no live value outside a provider (every other panel that uses the control)', async () => {
    await act(async () => root.render(<Cinema2SchemaControl control={control('depth-rate', 1.1)} onChange={() => {}} onTrigger={() => {}} />))
    expect(container.querySelector('[data-live-value]')).toBeNull()
  })
})

describe('resolving live values', () => {
  const plan = { targets: { targets: [
    { id: 'p', kind: 'parameter', channel: 'value', parameterId: 'a' }, { id: 'm', kind: 'module', channel: 'value', parameterId: 'a' },
    { id: 'p2', kind: 'parameter', channel: 'value', parameterId: 'b' }, { id: 'm2', kind: 'effect', channel: 'value', parameterId: 'b' },
    { id: 'x', kind: 'module', channel: 'action', parameterId: 'c' },
  ] } } as never
  const resolver = (values: Record<string, unknown>) => ({ resolve: (id: string) => ({ ok: id in values, value: values[id], target: null, diagnostics: [] }) }) as never
  const ranges = new Map<string, readonly [number, number]>([['a', [0, 4]], ['b', [0, 1]], ['c', [0, 1]]])

  it('returns only the controls whose bound module or effect target differs from the saved value, and ignores the parameter\'s own target', () => {
    const out = resolveCinema2LiveValues(plan, resolver({ p: 9, m: 2, p2: 9, m2: .5 }), { a: 1.1, b: .5, c: .3 }, ranges)
    expect([...out]).toEqual([['a', 2]])
  })

  it('ignores differences too small to see (under 0.4% of the range), non-numbers, unresolved targets and unsaved controls', () => {
    expect(resolveCinema2LiveValues(plan, resolver({ m: 1.1 + 4 * .003 }), { a: 1.1 }, ranges).size).toBe(0)
    expect(resolveCinema2LiveValues(plan, resolver({ m: 'x' }), { a: 1.1 }, ranges).size).toBe(0)
    expect(resolveCinema2LiveValues(plan, resolver({}), { a: 1.1 }, ranges).size).toBe(0)
    expect(resolveCinema2LiveValues(plan, resolver({ m: 3 }), {}, ranges).size).toBe(0)
  })
})

describe('Pattern Change and Trigger: what Auto Performance is choosing', () => {
  const options = [{ value: 'bar8', label: 'Every 8 Bars' }, { value: 'bar4', label: 'Every 4 Bars' }, { value: 'bar', label: 'Every Bar' }]
  const controls = [{ id: 'pc', policy: 'patternChange' as const }, { id: 'tr', policy: 'trigger' as const, options }]

  it('words the music\'s choice on both controls, with the reason', () => {
    const out = resolveCinema2LivePolicy(controls, true, { patternChange: true, trigger: 'bar4', reason: 'driving' })
    expect(out.get('pc')).toBe('Auto Performance is choosing: On, Every 4 Bars for a driving passage')
    expect(out.get('tr')).toBe('Auto Performance is choosing: Every 4 Bars')
    const held = resolveCinema2LivePolicy(controls, true, { patternChange: false, trigger: 'bar', reason: 'silence' })
    expect(held.get('pc')).toBe('Auto Performance is choosing: Off (holding the pattern) for a silent stop')
    expect(held.get('tr')).toBe('Auto Performance is choosing: Every Bar (holding the pattern)')
  })

  it('says nothing with Auto Performance off, or when the music has no choice (no beat grid), so the saved values simply stand', () => {
    expect(resolveCinema2LivePolicy(controls, false, { patternChange: true, trigger: 'bar4', reason: 'driving' }).size).toBe(0)
    expect(resolveCinema2LivePolicy(controls, true, null).size).toBe(0)
    expect(resolveCinema2LivePolicy([], true, { patternChange: true, trigger: 'bar4', reason: 'driving' }).size).toBe(0)
  })

  it('shows the choice under the Pattern Change toggle and the Trigger dropdown, and only for those', async () => {
    const toggle = { definition: { id: 'pc', label: 'Pattern Change', type: 'boolean', defaultValue: false, description: 'x' }, value: false, enabled: true, disabledReason: null } as never
    const select = { definition: { id: 'tr', label: 'Trigger', type: 'enum', defaultValue: 'bar4', options, description: 'x' }, value: 'bar8', enabled: true, disabledReason: null } as never
    const other = { definition: { id: 'other', label: 'Other', type: 'boolean', defaultValue: false, description: 'x' }, value: false, enabled: true, disabledReason: null } as never
    await act(async () => root.render(
      <Cinema2LivePolicyProvider value={new Map([['pc', 'Auto Performance is choosing: On, Every Bar'], ['tr', 'Auto Performance is choosing: Every Bar']])}>
        <Cinema2SchemaControl control={toggle} onChange={() => {}} onTrigger={() => {}} />
        <Cinema2SchemaControl control={select} onChange={() => {}} onTrigger={() => {}} />
        <Cinema2SchemaControl control={other} onChange={() => {}} onTrigger={() => {}} />
      </Cinema2LivePolicyProvider>,
    ))
    const lines = [...container.querySelectorAll('[data-live-policy]')].map(el => el.textContent)
    expect(lines).toEqual(['Auto Performance is choosing: On, Every Bar', 'Auto Performance is choosing: Every Bar'])
  })

  it('has Depth\'s Pattern Change and Trigger tagged for it, and leaves the Pattern Change edit rule that turns Auto Performance off as it was', () => {
    const find = (id: string) => CINEMA2_DEPTH_PRESET_MANIFEST.parameters!.find(parameter => parameter.id === id) as unknown as { metadata?: Record<string, unknown> }
    expect(find('depth-pattern-change').metadata).toMatchObject({ moodPolicy: 'patternChange', userEditSetParameters: { 'depth-auto-performance': false } })
    expect(find('depth-trigger').metadata).toMatchObject({ moodPolicy: 'trigger' })
  })

  it('finds the tagged controls and the Auto Performance toggle by their tags, not by label', () => {
    const controls = [
      { definition: { id: 'pc', metadata: { moodPolicy: 'patternChange' } } },
      { definition: { id: 'tr', metadata: { moodPolicy: 'trigger' }, options } },
      { definition: { id: 'ap', metadata: { moodPolicy: 'autoPerformance' } } },
      { definition: { id: 'decoy', label: 'Auto Performance', metadata: {} } },
      { definition: { id: 'plain' } },
    ]
    const found = findCinema2PolicyControls(controls)
    expect(found.autoId).toBe('ap')
    expect(found.controls.map(control => [control.id, control.policy])).toEqual([['pc', 'patternChange'], ['tr', 'trigger']])
    expect(found.controls[1]!.options).toBe(options)
    expect(findCinema2PolicyControls([{ definition: { id: 'plain' } }])).toEqual({ controls: [], autoId: null })
  })
})
