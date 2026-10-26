// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LayoutLabMockup } from '../../LayoutLabMockup'

// jsdom has no ResizeObserver or canvas; the dock's waveform canvas needs the former to size itself and skips drawing without the latter.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
}

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement

beforeEach(async () => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<LayoutLabMockup />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

const view = (id = 'design-01') => container.querySelector<HTMLElement>(`[data-lab-design="${id}"]`)!

/** A design is mounted the first time it is selected: visit B–E (each from the design on screen), then return to A. */
const visitAllDesigns = async () => {
  for (const letter of ['B', 'C', 'D', 'E', 'A']) {
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-lab-design]:not([hidden]) button[aria-label="Design ${letter}"]`)!.click())
  }
}
const OPTION_IDS = ['design-01', 'design-02', 'design-03', 'design-04', 'design-05']

const DROPDOWNS = '[role="combobox"], [role="listbox"], [role="option"], select, .dv-underline-dropdown, .drm-dropdown'

describe('Layout Lab canvas', () => {
  it('keeps B’s monitor free of a live renderer and its player independent', async () => {
    await act(async () => view().querySelector<HTMLButtonElement>('[aria-label="Design B"]')!.click())
    const b = view('design-02')
    expect(b.querySelector('.ob-stage-screen canvas, .ob-stage-screen video')).toBeNull()
    expect(b.querySelector('.ob-stage-screen')?.textContent).toContain('no live renderer')
    expect(b.querySelector('.ob-spine nav svg')?.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(b.querySelector('.ll-b-player-track-copy')?.textContent).toContain('Birthday Sex')
    await act(async () => b.querySelector<HTMLButtonElement>('[aria-label="Next track"]')!.click())
    expect(b.querySelector('.ll-b-player-track-copy')?.textContent).toContain('Trace of You')
    await act(async () => b.querySelector<HTMLButtonElement>('[aria-label="Play"]')!.click())
    expect(b.querySelector('[aria-label="Pause"]')).not.toBeNull()
    // Option A's own deck is not affected by B's player.
    expect(view().querySelector('.oa-play')?.getAttribute('aria-label')).toBe('Play')
  })

  it('keeps dropdowns out of every design\'s header, navigation column, visualizer and dock', async () => {
    await visitAllDesigns()
    for (const id of OPTION_IDS) {
      const chrome = view(id)
      // Header group, navigation column, visualizer and dock never hold a dropdown (the center column's windows, like the cue list's filter, may).
      const selectors = id === 'design-01'
        ? ['.oa-header', '.oa-spine', '.oa-stage', '.oa-dock']
        : id === 'design-02' ? ['.ob-header', '.ob-spine', '.ob-stage', '.ob-dock'] : id === 'design-03' ? ['.oc-header', '.oc-nav', '.oc-stage', '.oc-dock'] : id === 'design-04' ? ['.od-header', '.od-nav', '.od-stage', '.od-dock'] : ['.fw-app-header', '.fw-app-navigation', '.rv-canvas-wrap', '.vz-transport-dock']
      for (const selector of selectors) expect(chrome.querySelector(`${selector} :is(${DROPDOWNS})`), `${id} ${selector}`).toBeNull()
    }
  })

  it('builds Option A’s workspace module from its own components and leaves D–E on the production left and right windows', async () => {
    const left = view().querySelector<HTMLElement>('.oa-module--left')!
    expect(left.getAttribute('aria-label')).toBe('Layout Lab left window')
    expect(left.querySelector('.oa-window-head__title')?.textContent).toBe('React')
    expect(left.querySelector('.oa-engine__name')?.textContent).toBe('Cinema 2.0')
    expect(left.querySelector('.oa-engine__preset')?.textContent).toBe('Electric Storm')
    expect([...left.querySelectorAll('.oa-bank [role="tab"]')].map(tab => tab.querySelector('.oa-bank__label')?.textContent)).toEqual(['Source', 'Layers', 'Notice'])
    expect(left.querySelector('.oa-bank [aria-selected="true"]')?.textContent).toContain('Source')
    expect(left.querySelector('.oa-group__title')?.textContent).toBe('Media Library')
    expect([...left.querySelectorAll('.oa-segments [role="tab"]')].map(tab => tab.textContent)).toEqual(['ALL', 'COLLECTIONS', 'FAVORITES', 'IMAGES', 'VIDEOS'])
    expect(left.querySelectorAll('.oa-tile').length).toBeGreaterThanOrEqual(24)
    expect(left.querySelectorAll('.oa-tile[data-selected="true"]')).toHaveLength(1)
    // The Media Library filters, searches and selects on local state.
    const tab = (label: string) => [...left.querySelectorAll<HTMLElement>('.oa-segments [role="tab"]')].find(node => node.textContent === label)!
    await act(async () => tab('VIDEOS').click())
    expect(left.querySelectorAll('.oa-tile[data-kind="image"]')).toHaveLength(0)
    expect(left.querySelectorAll('.oa-tile[data-kind="video"]').length).toBe(4)
    await act(async () => tab('COLLECTIONS').click())
    expect(left.querySelector('.oa-empty')?.textContent).toBe('No collections in this mockup.')
    await act(async () => tab('ALL').click())
    await act(async () => left.querySelectorAll<HTMLElement>('.oa-tile')[0]!.click())
    expect(left.querySelector('.oa-tile[data-selected="true"]')).toBe(left.querySelectorAll('.oa-tile')[0])
    await act(async () => left.querySelector<HTMLButtonElement>('button[title="List view"]')!.click())
    expect(left.querySelectorAll('.oa-tile')).toHaveLength(0)
    expect(left.querySelectorAll('.oa-rows .oa-row').length).toBeGreaterThanOrEqual(24)

    // LAYERS lists the compiled Electric Storm layer, not an empty placeholder.
    await act(async () => left.querySelectorAll<HTMLElement>('.oa-bank [role="tab"]')[1]!.click())
    expect(left.querySelector('.oa-group__title')?.textContent).toBe('Layers')
    const layers = left.querySelectorAll('.oa-row--layer')
    expect(layers).toHaveLength(1)
    expect(layers[0]?.textContent).toContain('Electric Storm')
    expect(layers[0]?.textContent).toContain('100% · normal')

    // Option A has none of production's rail, shell or dock layout classes; E keeps them.
    expect(view().querySelector('.fw-app-shell, .rv-layout, .vz-transport-dock, .rw-window-header, .rv-engine-dropdown')).toBeNull()
    await visitAllDesigns()
    for (const id of OPTION_IDS.slice(4)) {
      expect(view(id).querySelector('.vz-inspector--left .rw-window-header-label')?.textContent, id).toBe('React Workspace')
      expect(view(id).querySelector('.vz-inspector--right .rw-window-header-label')?.textContent, id).toBe('Inspector')
      expect(view(id).querySelector('.vz-inspector--left .rv-engine-dropdown-preset')?.textContent, id).toBe('Electric Storm')
    }
  })

  it('builds the Inspector DESIGN tab from Option A’s own knobs, faders, switches, selects and swatches', async () => {
    const right = view().querySelector<HTMLElement>('.oa-module--right')!
    expect(right.getAttribute('aria-label')).toBe('Layout Lab right window')
    expect(right.querySelector('.oa-window-head__title')?.textContent).toBe('Inspector')
    expect([...right.querySelectorAll('.oa-bank [role="tab"]')].map(tab => tab.querySelector('.oa-bank__label')?.textContent)).toEqual(['Presets', 'Design', 'React', 'Audio', 'Tracks'])
    expect(right.querySelector('.oa-bank [aria-selected="true"]')?.textContent).toContain('Design')
    expect([...right.querySelectorAll('.oa-design > .oa-segments [role="tab"]')].map(tab => tab.textContent)).toEqual(['Engine', 'Selection'])
    expect(right.querySelector('.oa-design > .oa-segments [role="tab"]:last-child')?.hasAttribute('disabled') ?? false).toBe(false)

    const groups = (nested: boolean) => [...right.querySelectorAll(`.oa-group[data-nested="${nested}"] > .oa-group__head .oa-group__title`)].map(node => node.textContent)
    expect(groups(false)).toEqual(['Master Controls', 'Design', 'Effects', 'Palette'])
    expect(groups(true)).toEqual(['Pattern', 'Marquee Copy', 'Lighting Zones'])
    expect(right.querySelector('[data-cinema2-design-parent-groups]')).not.toBeNull()

    // Knobs: Master Intensity and Camera Motion, then the four Effects, each a real slider that takes the keyboard.
    const knob = (label: string) => right.querySelector<HTMLElement>(`.oa-knob__dial[aria-label="${label}"]`)!
    expect([...right.querySelectorAll('.oa-knob__dial')].map(node => node.getAttribute('aria-label'))).toEqual(['Master Intensity', 'Camera Motion', 'Bloom', 'Haze', 'Wet Street Reflections', 'Cinematic Finish'])
    expect(knob('Master Intensity').getAttribute('aria-valuenow')).toBe('0.9')
    await act(async () => { knob('Master Intensity').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })) })
    expect(Number(knob('Master Intensity').getAttribute('aria-valuenow'))).toBeCloseTo(0.85, 5)
    await act(async () => { knob('Master Intensity').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })) })
    expect(knob('Master Intensity').getAttribute('aria-valuenow')).toBe('1')
    expect(knob('Haze').getAttribute('aria-valuetext')).toBe('0.008')
    await act(async () => { knob('Haze').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })) })
    expect(knob('Haze').getAttribute('aria-valuenow')).toBe('0.008')

    // Faders are range inputs labelled by their rows: Sign Illumination and the six lighting zones.
    const faders = [...right.querySelectorAll<HTMLInputElement>('.oa-fader__input')]
    expect(faders.map(input => right.querySelector(`label[for="${input.id}"]`)?.textContent)).toEqual([
      'Sign Illumination', 'Front Marquee', 'Side Marquees', 'Canopy Underside', 'Vertical Towers', 'Entrance LEDs', 'Neon Crown',
    ])
    expect(faders[0]!.value).toBe('0.78')

    // Switches carry their state; Pattern Change shows and hides Trigger; picking a Pattern turns Auto Performance off.
    const sw = (label: string) => [...right.querySelectorAll<HTMLElement>('.oa-switch')].find(node => node.textContent?.startsWith(label))!
    expect(sw('BPM Sync').getAttribute('aria-checked')).toBe('true')
    expect(sw('Auto Performance').textContent).toContain('Temporarily chooses build and drop looks')
    expect(right.querySelector('.oa-select__label')?.textContent).toBe('Pattern')
    expect([...right.querySelectorAll('.oa-select__label')].map(node => node.textContent)).toEqual(['Pattern', 'Trigger'])
    await act(async () => sw('Pattern Change').click())
    expect(sw('Pattern Change').getAttribute('aria-checked')).toBe('false')
    expect([...right.querySelectorAll('.oa-select__label')].map(node => node.textContent)).toEqual(['Pattern'])
    await act(async () => sw('BPM Sync').click())
    expect(sw('BPM Sync').getAttribute('aria-checked')).toBe('false')

    // Marquee copy fields and the palette swatches.
    expect(right.querySelector<HTMLInputElement>('input[value="DVYDRM B2B GOONZ"]')).not.toBeNull()
    expect([...right.querySelectorAll('.oa-field__label')].map(node => node.textContent)).toEqual(['Front Marquee Text', 'Left Marquee Text', 'Right Marquee Text'])
    expect([...right.querySelectorAll('.oa-swatch__label')].map(node => node.textContent)).toEqual(['Night Atmosphere', 'Marquee Red', 'Incandescent Gold', 'Neon Blue', 'Architectural Accent'])
    expect(right.querySelector('.oa-swatch__hex')?.textContent).toBe('#030609')

    // A group collapses from its header.
    const head = right.querySelector<HTMLElement>('.oa-group__head')!
    await act(async () => head.click())
    expect(head.getAttribute('aria-expanded')).toBe('false')
    expect(right.querySelector('.oa-knob__dial[aria-label="Master Intensity"]')).toBeNull()
    await act(async () => head.click())
    expect(right.querySelector('.oa-knob__dial[aria-label="Master Intensity"]')).not.toBeNull()
  })

  it('mocks the Cinema 2.0 PRESETS tab and the Canvas REACT tab in design A\'s inspector, inside Option A\'s module', async () => {
    const right = view().querySelector<HTMLElement>('.oa-module--right')!
    const tab = (label: string) => [...right.querySelectorAll<HTMLButtonElement>('.oa-bank [role="tab"]')].find(node => node.querySelector('.oa-bank__label')?.textContent === label)!

    await act(async () => tab('Presets').click())
    expect([...right.querySelectorAll('.rv-right-subtabs [role="tab"]')].map(node => node.textContent)).toEqual(['SYSTEM', 'USER'])
    expect(right.querySelector('input[aria-label="Search Cinema 2.0 presets"]')).not.toBeNull()
    const presetIds = [...right.querySelectorAll('[data-cinema2-preset-id]')].map(node => node.getAttribute('data-cinema2-preset-id'))
    expect(presetIds.length).toBeGreaterThan(10)
    expect(presetIds).toEqual(expect.arrayContaining(['drmvyz.cinema2.electric-storm', 'drmvyz.cinema2.marquee']))
    expect(right.querySelector('.rv-preset-group-cards--poster[data-preset-columns="2"]')).not.toBeNull()
    // Loading a preset only moves the highlight; the scope switch shows the empty user list.
    await act(async () => (right.querySelector('[data-cinema2-preset-id="drmvyz.cinema2.marquee"]') as HTMLElement).click())
    await act(async () => [...right.querySelectorAll<HTMLButtonElement>('.rv-right-subtabs [role="tab"]')].find(node => node.textContent === 'USER')!.click())
    expect(right.textContent).toContain('No user presets yet.')

    await act(async () => tab('React').click())
    expect([...right.querySelectorAll('.rv-right-subtabs [role="tab"]')].map(node => node.textContent)).toEqual(['ROUTING', 'ANALYSIS'])
    expect([...right.querySelectorAll('.drc-group > .drc-header')].map(node => node.textContent)).toEqual(['Effects', 'Performance Automation', 'Motion', 'Preset FX'])
    for (const label of ['Auto Select', 'Auto Performance', 'Pool Automation', 'Pool Trigger', 'Pool Transition', 'Performance Show', 'Layer Complexity', 'Cut Density', 'Glow Amount', 'RGB Split', 'Motion Amount', 'Turbulence']) {
      expect([...right.querySelectorAll('.rv-ctrl-label')].map(node => node.textContent), label).toContain(label)
    }
    // The dependants stay disabled until Pool Automation / Auto Performance is on, and the two switch each other off.
    const toggle = (label: string) => [...right.querySelectorAll<HTMLElement>('.rv-ctrl-toggle-row')].find(row => row.textContent?.startsWith(label))!.querySelector('button')!
    const pressed = (label: string) => toggle(label).getAttribute('aria-pressed') ?? toggle(label).getAttribute('aria-checked')
    expect(pressed('Pool Automation')).toBe('false')
    await act(async () => toggle('Pool Automation').click())
    expect(pressed('Pool Automation')).toBe('true')
    await act(async () => toggle('Auto Performance').click())
    expect([pressed('Auto Performance'), pressed('Pool Automation')]).toEqual(['true', 'false'])

    await act(async () => tab('Design').click())
    expect(right.querySelector('[data-cinema2-design-parent-groups]')).not.toBeNull()
    expect(right.querySelector('.oa-design')).not.toBeNull()
  })

  it('shows the Audio Intelligence window with static, differing values in design A\'s AUDIO tab', async () => {
    const right = view().querySelector<HTMLElement>('.oa-module--right')!
    const audio = [...right.querySelectorAll<HTMLButtonElement>('.oa-bank [role="tab"]')].find(node => node.querySelector('.oa-bank__label')?.textContent === 'Audio')!
    await act(async () => audio.click())
    // The panel writes its values on animation frames; let one run.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 80)) })

    const panel = right.querySelector<HTMLElement>('.ll-audio-intelligence')!
    expect(panel.querySelector('.ttv-analysis-panel-header span')?.textContent).toBe('Audio Intelligence')
    // The real production panel, with the Track header grid above its sections.
    expect(panel.querySelector('.vz-mi-panel.vz-mi-panel--ungrouped')).not.toBeNull()
    expect([...panel.querySelectorAll('.ttv-track-info-label')].map(node => node.textContent)).toEqual([
      'Track Title', 'Artist Name', 'Length', 'BPM', 'Time Signature', 'Key', 'Beats', 'Sections', 'Sample Rate', 'Position',
    ])
    for (const title of ['Track', 'Audio Bands', 'Rhythm', 'Beat Grid', 'Musical Phrases', 'Energy', 'Measurements', 'Section', 'Section & Structure', 'Event Markers', 'Harmonic', 'Stems', 'Lyrics', 'Semantic']) {
      expect(panel.textContent, title).toContain(title)
    }
    expect(panel.querySelectorAll('.vz-mi-section').length).toBeGreaterThanOrEqual(14)

    // Static values that differ: the six band bars read 0.98 … 0.23 and are all distinct, and the bars are filled to match.
    const bandValues = [...panel.querySelectorAll('.vz-mi-bar-val')].slice(0, 6).map(node => node.textContent)
    expect(bandValues).toEqual(['0.98', '0.85', '0.66', '0.56', '0.50', '0.23'])
    expect(new Set(bandValues).size).toBe(6)
    const fills = [...panel.querySelectorAll<HTMLElement>('.vz-mi-bar-fill')].slice(0, 6).map(node => node.style.height || node.style.width)
    expect(new Set(fills).size).toBe(6)
    const dots = [...panel.querySelectorAll('.vz-mi-dot')]
    expect(dots.some(dot => dot.classList.contains('vz-mi-dot--on'))).toBe(true)
    expect(dots.some(dot => !dot.classList.contains('vz-mi-dot--on'))).toBe(true)
    expect(panel.textContent).toContain('129.0')
    expect(panel.textContent).toContain('C# major')
    expect(panel.textContent).toContain('epidemic')
  })

  it('mirrors the Track Map workspace under design A\'s visualizer with every row populated', async () => {
    const column = view().querySelector<HTMLElement>('.oa-rack')!
    expect([...column.children].map(node => node.className.split(' ')[0])).toEqual(['ll-lyric-timeline-host', 'rv-lower-workspace', 'll-lyric-timeline-host', 'll-lyric-timeline-host'])
    // The stage is the first item of Option A's scrolling column, ahead of the rack of windows.
    expect(view().querySelector('.oa-center')!.firstElementChild?.className).toBe('oa-stage')
    const workspace = column.querySelector<HTMLElement>('.rv-lower-workspace')!
    expect([...workspace.querySelectorAll('.rv-lower-workspace-tabs [role="tab"]')].map(node => node.textContent)).toEqual(['Track Map', 'Performance Pads'])
    expect(workspace.querySelector('[role="separator"]')?.getAttribute('aria-label')).toBe('Resize timeline workspace')
    expect(['Expand Track Map row icons', 'Cast visual output', 'Maximize the live output stage'].every(label => workspace.querySelector(`button[aria-label="${label}"]`))).toBe(true)

    // Lanes in production's order, with the four marker rows, each populated.
    const lanes = workspace.querySelector<HTMLElement>('.rv-timeline-lanes')!
    expect([...lanes.querySelectorAll(':scope > .rv-timeline-lane')].map(node => node.getAttribute('aria-label'))).toEqual(['Beat Grid', 'Sections', 'Cues and Presets', 'Visible Range'])
    expect([...lanes.querySelectorAll('.rv-timeline-cue-row')].map(row => (row as HTMLElement).dataset.cueRow)).toEqual(['cues', 'phrases', 'moments', 'actions'])
    for (const row of lanes.querySelectorAll('.rv-timeline-cue-row')) expect(row.querySelectorAll('.rv-timeline-cue').length).toBeGreaterThan(0)
    // Sections: twelve, covering every section type.
    expect(workspace.querySelectorAll('[data-section-region]').length).toBe(12)
    // Rekordbox metadata: hot cues A–H, memory cues and loops sit beside the manual cues, with bar / beat detail in the titles.
    const cueLabels = [...lanes.querySelectorAll('.rv-timeline-cue-row[data-cue-row="cues"] .rv-timeline-cue-label')].map(node => node.textContent)
    for (const label of ['A · Intro', 'B · Verse', 'C · Build', 'D · Drop', 'E · Break', 'F · Bridge', 'G · Build 2', 'H · Drop 2', 'Memory 1', 'Memory 3', 'Loop · 8 bars', 'Loop · 4 bars', 'Cue 1', 'Cue 2']) {
      expect(cueLabels, label).toContain(label)
    }
    expect(lanes.querySelector('.rv-timeline-cue[title*="Bar "][title*="Snapped to beat grid"]')).not.toBeNull()
    expect(lanes.querySelector('.rv-timeline-cue--disabled')).not.toBeNull()
    expect(lanes.querySelector('.rv-timeline-cue--pixgrid')).not.toBeNull()
    expect(lanes.querySelector('.rv-timeline-shared-playhead')).not.toBeNull()

    // A section opens its detail overview, with a way back; the row-icons key widens the label gutter.
    await act(async () => (workspace.querySelectorAll<HTMLElement>('[data-section-region] .rv-section-body')[4]!).click())
    const detail = workspace.querySelector('.rv-timeline-detail-overview')!
    expect(detail.querySelector('strong')?.textContent).toBe('Drop 1')
    expect(detail.textContent).toContain('Electric Storm')
    expect(detail.querySelector('.rv-confidence-badge')).not.toBeNull()
    await act(async () => detail.querySelector<HTMLElement>('.rv-timeline-detail-back')!.click())
    expect(workspace.querySelector('.rv-timeline-lanes')).not.toBeNull()
    await act(async () => workspace.querySelector<HTMLElement>('.rv-track-map-lane-icons-toggle')!.click())
    expect(workspace.querySelector('.rv-timeline-lanes--icons-expanded')).not.toBeNull()
    // Designs B–E carry the same Track Map workspace under their visualizer.
    await visitAllDesigns()
    for (const id of OPTION_IDS) expect(view(id).querySelector('.rv-lower-workspace [role="tab"]')?.textContent, id).toBe('Track Map')
  })

  it('builds Option A’s dock as a deck, a scope and a tempo dial on local-only state, and leaves B–E on the production dock', async () => {
    const dock = view().querySelector<HTMLElement>('.oa-dock')!
    expect([...dock.children].filter(node => node.tagName === 'SECTION').map(node => node.className)).toEqual(['oa-deck', 'oa-scopebay', 'oa-tempo'])
    expect(dock.querySelector('.oa-deck__title')?.textContent).toContain('Birthday Sex')
    expect(dock.querySelector('.oa-deck__slot')?.textContent).toBe('02 / 03')
    expect(dock.querySelector('.oa-deck__replace span')?.textContent).toBe('Replace track')
    expect(dock.querySelector('.oa-tempo__source strong')?.textContent).toBe('Rekordbox')
    expect(dock.querySelector('button[aria-label^="Audio source"]')).not.toBeNull()
    expect([...dock.querySelectorAll('.oa-tempo__keys > button')].map(node => node.getAttribute('aria-label'))).toEqual([
      'Tap tempo', 'Jump to cue (0:00)', 'BPM Sync: ON', 'Audio source & Rekordbox', 'Playlist', 'Open the Track Timeline Visualizer',
    ])
    // The waveform is Option A's own scope drawn from the same analysis; the deck canvas of production is not mounted.
    expect(dock.querySelector('canvas.oa-scope')).not.toBeNull()
    expect(dock.querySelector('.vz-peaks-wrap, .vz-mini-waveform')).toBeNull()
    expect(dock.querySelector('.oa-scopebay__time')?.textContent).toContain('0:12.7')

    const click = (selector: string) => act(async () => dock.querySelector<HTMLElement>(selector)!.click())
    expect(dock.querySelector('.oa-play')?.getAttribute('aria-label')).toBe('Play')
    await click('.oa-play')
    expect(dock.querySelector('.oa-play')?.getAttribute('aria-label')).toBe('Pause')
    await click('button[aria-label="Previous track"]')
    expect(dock.querySelector<HTMLButtonElement>('button[aria-label="Previous track"]')!.disabled).toBe(true)
    expect(dock.querySelector('.oa-deck__title')?.textContent).toContain('Mocha ID')
    // Zoom keys honour their limits; sync toggles.
    expect(dock.querySelector<HTMLButtonElement>('button[aria-label="Zoom out"]')!.disabled).toBe(true)
    await click('button[aria-label="Zoom in"]')
    expect(dock.querySelector('.oa-scopebay__zoomvalue')?.textContent).toBe('Zoom ×2')
    await click('button[aria-label="BPM Sync: ON"]')
    expect(dock.querySelector('button[aria-label="BPM Sync: OFF"]')).not.toBeNull()
    // The tempo dial is a slider: keys move the BPM, and an override offers a reset to the analysed 129.00.
    const dial = dock.querySelector<HTMLElement>('.oa-tempo__ring')!
    expect(dial.getAttribute('aria-valuenow')).toBe('129')
    await act(async () => { dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })) })
    expect(dock.querySelector('.oa-tempo__readout strong')?.textContent).toBe('130.00')
    await click('button[aria-label="Reset BPM"]')
    expect(dock.querySelector('.oa-tempo__readout strong')?.textContent).toBe('129.00')
    // The level knob reads in dB.
    expect(dock.querySelector('.oa-knob__dial[aria-label="Volume"]')?.getAttribute('aria-valuetext')).toBe('-1.7 dB')
    // Clicking empty dock space collapses it, as in production.
    await act(async () => dock.click())
    expect(dock.getAttribute('data-collapsed')).toBe('true')
    await act(async () => dock.click())
    expect(dock.getAttribute('data-collapsed')).toBe('false')

    // Designs B–E carry the production dock; Option A's is not shared with them.
    await visitAllDesigns()
    for (const id of OPTION_IDS.slice(1)) expect(view(id).querySelector('.vz-dock-source-trigger, .ll-b-player-track-copy, .oc-record, .od-record'), id).not.toBeNull()
  })

  it('rebuilds the header readings as Option A’s instrument strip and names every option at the top left', async () => {
    const header = view().querySelector<HTMLElement>('.oa-header')!
    expect(header.getAttribute('aria-label')).toBe('Layout Lab header group')
    expect(header.querySelector('.oa-wordmark')?.textContent).toBe('DRMVYZ')
    expect(header.querySelector('.oa-header__option')?.textContent).toBe('Option A')
    expect([...header.querySelectorAll('.oa-header__output button')].map(button => button.getAttribute('aria-label'))).toEqual(['OUTPUT PREVIEW', 'Reveal output', 'Blackout output'])
    expect([...header.querySelectorAll('.oa-header__output button')].every(button => (button as HTMLButtonElement).disabled)).toBe(true)
    expect(header.querySelector('button[aria-label="Layout Lab"]')).not.toBeNull()
    // The same readings as production, drawn as readouts: Loading, Saved, FPS, Frame time, Quality, CPU, Notifications and Profile.
    expect([...header.querySelectorAll('.oa-readout')].map(node => node.getAttribute('aria-label'))).toEqual([
      'Nothing loading', 'Saved 11:31 AM', 'FPS 60', 'Frame time 16.6 ms', 'Quality high', 'App CPU usage 0 percent',
    ])
    expect(header.querySelector('.oa-readout--ring svg')).not.toBeNull()
    expect(header.querySelectorAll('.oa-ladder .oa-led[data-on="true"]')).toHaveLength(3)
    expect(header.querySelector('button[aria-label="Notifications"]')).not.toBeNull()
    expect(header.querySelector('.oa-avatar')?.textContent).toBe('DV')
    await visitAllDesigns()
    for (const [index, id] of OPTION_IDS.slice(4).entries()) {
      const surface = view(id).querySelector<HTMLElement>('.fw-app-header-surface')!
      // "Option E" hangs off the brand toggle, the first thing in the header group.
      const lead = surface.querySelector<HTMLElement>('.fw-app-header-inner > .ll-header-lead')!
      expect(surface.querySelector('.fw-app-header-inner')!.firstElementChild, id).toBe(lead)
      expect(lead.querySelector('.ll-option-label')?.textContent, id).toBe(`Option ${'E'[index]}`)
      expect(surface.querySelector('.fw-app-header-controls .vz-header-avatar, .fw-app-header-controls button[aria-label="Notifications"]'), id).not.toBeNull()
    }
  })

  it('composes Option A as a spine, a header strip, three modules and a deck, scoped to Option A alone', async () => {
    const a = view()
    expect(a.classList.contains('oa-root')).toBe(true)
    expect(a.matches('[data-workspace-layout="floating"][data-app-workspace="react"]')).toBe(true)
    const app = a.querySelector('.oa-app')!
    expect([...app.children].map(node => node.className)).toEqual(['oa-spine', 'oa-main'])
    // The header sits above the working area only; the spine runs the full height beside it.
    const main = app.querySelector('.oa-main')!
    expect([...main.children].map(node => node.className.split(' ')[0])).toEqual(['oa-header', 'oa-body', 'oa-dock'])
    expect([...main.querySelector('.oa-body')!.children].map(node => node.className.split(' ')[0])).toEqual(['oa-module', 'oa-center', 'oa-module'])
    expect([...a.querySelector('.oa-center')!.children].map(node => node.className)).toEqual(['oa-stage', 'oa-rack'])

    // The spine keeps the five destinations and the untouched Layout Lab selector.
    const spine = a.querySelector<HTMLElement>('.oa-spine')!
    expect(spine.getAttribute('aria-label')).toBe('Layout Lab navigation column')
    expect([...spine.querySelectorAll('.oa-key')].map(item => item.getAttribute('aria-label'))).toEqual(['React', 'Preset Manager', 'Show Manager', 'Lyric Manager', 'Media Manager'])
    expect(spine.querySelector('.oa-spine__section')?.textContent).toBe('Managers')
    expect(spine.querySelector('.oa-key[data-active="true"]')?.getAttribute('aria-label')).toBe('React')
    expect(spine.querySelector('.oa-spine__licence')?.textContent).toContain('Professional')
    expect(spine.querySelector('.ll-design-switcher')?.getAttribute('aria-label')).toBe('Layout Lab design')
    expect(spine.querySelectorAll('.ll-design-switch')).toHaveLength(5)
    await act(async () => spine.querySelectorAll<HTMLElement>('.oa-key')[3]!.click())
    expect(spine.querySelector('.oa-key[data-active="true"]')?.getAttribute('aria-label')).toBe('Lyric Manager')

    // The stage is an empty, labelled viewport with working guides; nothing renders into it.
    const stage = a.querySelector<HTMLElement>('.oa-stage')!
    expect(stage.getAttribute('aria-label')).toBe('Layout Lab visualizer')
    expect(stage.querySelector('canvas, video, audio')).toBeNull()
    expect(stage.querySelector('.oa-stage__screen')?.textContent).toBe('')
    expect(stage.textContent).toContain('Preview · no output')
    const grid = [...stage.querySelectorAll<HTMLButtonElement>('.oa-chip')].find(node => node.textContent === 'Grid')!
    await act(async () => grid.click())
    expect(stage.querySelector('.oa-stage__screen')?.getAttribute('data-grid')).toBe('true')

    // Option E keeps React View's frame, shell, rails and dock, and none of Option A's classes.
    await visitAllDesigns()
    for (const id of OPTION_IDS.slice(4)) {
      const other = view(id)
      expect(other.classList.contains('oa-root'), id).toBe(false)
      expect(other.querySelector('[class*="oa-"]'), id).toBeNull()
      expect(other.querySelector('.fw-app-shell .rv-shell.rv-shell--floating > .rv-layout'), id).not.toBeNull()
      expect([...other.querySelector('.fw-app-navigation > .az-sidebar')!.children].map(node => node.className), id).toEqual(['az-nav', 'll-design-switcher', 'az-sidebar-footer'])
      expect([...other.querySelector('.rv-layout')!.children].map(node => node.className.split(' ')[0]), id).toEqual(['vz-inspector', 'rv-center-col', 'vz-inspector'])
    }
  })

  it('switches between five independent designs with the A–E buttons', async () => {
    const ids = ['design-01', 'design-02', 'design-03', 'design-04', 'design-05']
    // A design is mounted the first time it is selected, and stays mounted (hidden) afterwards.
    expect([...container.querySelectorAll('[data-lab-design]')].map(node => node.getAttribute('data-lab-design'))).toEqual(['design-01'])
    const visible = () => [...container.querySelectorAll<HTMLElement>('[data-lab-design]:not([hidden])')].map(node => node.dataset.labDesign)
    expect(visible()).toEqual(['design-01'])

    // Each design carries its own copy of the switcher, so it can be changed from any view.
    for (const [index, letter] of ['A', 'B', 'C', 'D', 'E'].entries()) {
      const button = view(visible()[0]).querySelector<HTMLButtonElement>(`button[aria-label="Design ${letter}"]`)!
      await act(async () => button.click())
      expect(visible()).toEqual([ids[index]])
      const pressed = [...view(ids[index]).querySelectorAll<HTMLButtonElement>('.ll-design-switch')].map(node => node.getAttribute('aria-pressed'))
      expect(pressed).toEqual(['A', 'B', 'C', 'D', 'E'].map(l => String(l === letter)))
    }
    await act(async () => view('design-05').querySelector<HTMLButtonElement>('button[aria-label="Design A"]')!.click())
    expect(visible()).toEqual(['design-01'])
    expect([...container.querySelectorAll('[data-lab-design]')].map(node => node.getAttribute('data-lab-design'))).toEqual(ids)
    // Hidden designs keep their own dock state: toggling playback in one does not touch another.
    const playButton = (id: string) => view(id).querySelector<HTMLButtonElement>('.oa-play, .az-play-btn, button[aria-label="Play"], button[aria-label="Pause"]')!
    const before = playButton('design-02').getAttribute('aria-label')
    await act(async () => playButton('design-01').click())
    expect(playButton('design-01').getAttribute('aria-label')).toBe('Pause')
    expect(playButton('design-02').getAttribute('aria-label')).toBe(before)
  })

  it("shows the Lyric Manager Tracks tab in design A's inspector, with versions nested in the selected track's card", async () => {
    const right = view().querySelector<HTMLElement>('.oa-module--right')!
    const tab = [...right.querySelectorAll<HTMLButtonElement>('.oa-bank [role="tab"]')].find(node => node.querySelector('.oa-bank__label')?.textContent === 'Tracks')!
    await act(async () => tab.click())
    const panel = right.querySelector<HTMLElement>('.lmv-left-rail .lmv-workspace-tab-panel')!
    expect(panel.getAttribute('aria-label')).toBe('Tracks panel')
    expect(panel.querySelector('.lmv-track-search-row input')?.getAttribute('placeholder')).toBe('Search title or artist…')
    expect(panel.querySelectorAll('.lmv-track-group').length).toBe(10)
    // Every record starts collapsed and plain: nothing selected, loaded, playing or expanded, and no versions or legacy list shown.
    expect(panel.querySelector('.vz-track-row--active, .vz-track-row--loaded, .vz-track-row--playing, .vz-track-row-selected-dot, .lmv-track-group--expanded')).toBeNull()
    expect(panel.querySelector('.lmv-track-versions, .lmv-doc-section-label')).toBeNull()
    // Clicking a record selects it and nests its versions in its card; clicking it again removes all of that.
    const first = () => panel.querySelector<HTMLElement>('.lmv-track-group > .vz-track-row')!
    await act(async () => first().click())
    expect(panel.querySelector('.vz-track-row-selected-dot')).not.toBeNull()
    const group = panel.querySelector('.lmv-track-group--expanded')!
    expect(group.querySelector('.vz-track-row-title')?.textContent).toBe('Neon Cathedral')
    expect(group.querySelectorAll('.lmv-version-row').length).toBe(5)
    expect(group.querySelector('.lmv-version-row--active')?.textContent).toContain('Active')
    await act(async () => group.querySelectorAll<HTMLElement>('.lmv-version-row')[1]!.click())
    expect(group.querySelector('.lmv-version-row--open')?.textContent).toContain('Open')
    await act(async () => first().click())
    expect(panel.querySelector('.vz-track-row--active, .vz-track-row-selected-dot, .lmv-track-group--expanded, .lmv-track-versions')).toBeNull()
    await act(async () => first().click())
    // Load marks a record Loaded (and Load again on it, Playing); both are plain until then.
    const load = () => panel.querySelectorAll<HTMLElement>('.lmv-track-group')[1]!.querySelector<HTMLElement>('button[aria-label^="Load"], button[aria-label^="Reload"]')!
    await act(async () => load().click())
    expect(panel.querySelector('.lmv-track-group > .vz-track-row--loaded')?.textContent).toContain('Static in the Sky')
    await act(async () => load().click())
    expect(panel.querySelector('.lmv-track-group > .vz-track-row--loaded.vz-track-row--playing')).not.toBeNull()
    expect([...panel.querySelector('.lmv-track-group--expanded')!.querySelectorAll('.lmv-track-versions-add')].map(node => node.textContent?.trim())).toEqual(['New version', 'Import version'])
    // Unattached legacy documents sit under the list, and Load More appends the next page.
    expect(panel.querySelector('.lmv-doc-section-label')?.textContent).toBe('LEGACY UNATTACHED DOCUMENTS')
    expect(panel.querySelectorAll('.lmv-track-versions--legacy .lmv-version-row')).toHaveLength(2)
    await act(async () => panel.querySelector<HTMLElement>('.lmv-load-more')!.click())
    expect(panel.querySelectorAll('.lmv-track-group').length).toBe(13)
    expect(panel.querySelector('.lmv-load-more')).toBeNull()
  })

  it('shows Option A’s notice card in every tone in the NOTICE tab', async () => {
    const left = view().querySelector<HTMLElement>('.oa-module--left')!
    await act(async () => [...left.querySelectorAll<HTMLElement>('.oa-bank [role="tab"]')].find(tab => tab.textContent?.includes('Notice'))!.click())
    expect([...left.querySelectorAll('.oa-group > .oa-group__head .oa-group__title')].map(node => node.textContent)).toEqual(['Info', 'Success', 'Warning', 'Error'])
    for (const tone of ['info', 'success', 'warning', 'error']) {
      const cards = left.querySelectorAll(`.oa-notice[data-tone="${tone}"]`)
      expect(cards, tone).toHaveLength(4)
      // Title and body, title only, with dismiss, and with dismiss and open.
      expect([...cards].map(card => [!!card.querySelector('.oa-notice__body'), !!card.querySelector('button[aria-label="Dismiss notice"]'), !!card.querySelector('button[aria-label="Open details"]')])).toEqual([
        [true, false, false], [false, false, false], [true, true, false], [true, true, true],
      ])
    }
    await act(async () => left.querySelectorAll<HTMLElement>('.oa-notice[data-tone="error"] button[aria-label="Dismiss notice"]')[0]!.click())
    expect(left.querySelectorAll('.oa-notice[data-tone="error"]')).toHaveLength(3)
  })

  it('places the Lyric Manager Track Timeline above the Track Map with every row and cue state, collapsing from its header', async () => {
    const host = view().querySelector<HTMLElement>('.oa-rack > .ll-lyric-timeline-host')!
    expect(host.getAttribute('data-app-workspace')).toBe('lyrics')
    const timeline = host.querySelector<HTMLElement>('.lmv-track-timeline-window')!
    expect(timeline.getAttribute('aria-label')).toBe('Track Timeline')
    expect(timeline.querySelector('.drc-header')?.textContent).toContain('Track Timeline')

    // Rows in production's order, then the three lyric lanes, under one playhead.
    expect([...timeline.querySelectorAll('.lmv-track-timeline-reference-lanes > .lmv-track-timeline-lane')].map(node => node.className.split('--')[1])).toEqual(['timing', 'beatgrid', 'section', 'waveform'])
    expect([...timeline.querySelectorAll('.lyric-cue-timeline__lane-label')].map(node => node.textContent)).toEqual(['Lyrics 1', 'Lyrics 2', 'Lyrics 3'])
    expect(timeline.querySelectorAll('.rv-section-region').length).toBe(12)
    expect(timeline.querySelector('.lmv-track-timeline-playhead-layer .lyric-cue-timeline__playhead')).not.toBeNull()

    // Every cue state the lanes can draw.
    expect(timeline.querySelectorAll('.lyric-cue-block').length).toBe(24)
    for (const state of ['active', 'selected', 'low-confidence', 'warning', 'stacked']) {
      expect(timeline.querySelector(`.lyric-cue-block--${state}`), state).not.toBeNull()
    }

    // The group collapses and expands from its header, like the Track Map's toolbar.
    const header = timeline.querySelector<HTMLElement>('.drc-header')!
    await act(async () => header.click())
    expect(header.getAttribute('aria-expanded')).toBe('false')
    expect(timeline.querySelector('.lmv-track-timeline-lanes')).toBeNull()
    await act(async () => header.click())
    expect(timeline.querySelector('.lmv-track-timeline-lanes')).not.toBeNull()
  })

  it('places the Lyric Manager Cue list under the Track Timeline, sharing its cues and collapsing from its header', async () => {
    const host = view().querySelector<HTMLElement>('.oa-rack > .ll-lyric-timeline-host')!
    expect([...host.children].map(node => node.className)).toEqual(['lmv-track-timeline-window', 'lmv-lyric-cues-window'])
    const list = host.querySelector<HTMLElement>('.lmv-lyric-cues-window')!
    expect(list.querySelector('.drc-header')?.textContent).toContain('Cue list')
    expect(list.querySelector('.lyric-cue-list__controls strong')?.textContent).toBe('24 of 24 cues')
    expect([...list.querySelectorAll('thead th')].map(node => node.textContent)).toEqual(['#', 'Time', 'Lyric', 'Status'])
    expect(list.querySelectorAll('tbody tr[data-cue-row-id]').length).toBe(24)
    // Every status, a playing row, the low-confidence and warning-count marks, the expanded editor with word timings, and empty text.
    for (const status of ['unreviewed', 'reviewed', 'corrected', 'rejected']) expect(list.querySelector(`.lyric-cue-list__status-dot--${status}`), status).not.toBeNull()
    expect(list.querySelector('.lyric-cue-list__row--active')).not.toBeNull()
    expect(list.querySelector('.lyric-cue-list__low-confidence')).not.toBeNull()
    expect(list.querySelector('.lyric-cue-list__warning-count')).not.toBeNull()
    expect(list.querySelectorAll('.lyric-cue-list__editor .lyric-word-editor__row').length).toBe(4)
    expect([...list.querySelectorAll('tbody td.lyric-cue-list__text')].some(cell => cell.textContent === 'Empty')).toBe(true)

    // One cue editor: selecting a row selects the same cue in the lanes.
    await act(async () => list.querySelector<HTMLElement>('tr[data-cue-row-id="lt-cue-09"]')!.click())
    expect(host.querySelector('.lyric-cue-block--selected')?.getAttribute('data-cue-id')).toBe('lt-cue-09')

    const header = list.querySelector<HTMLElement>('.drc-header')!
    await act(async () => header.click())
    expect(header.getAttribute('aria-expanded')).toBe('false')
    expect(list.querySelector('.lyric-cue-list')).toBeNull()
    await act(async () => header.click())
    expect(list.querySelector('.lyric-cue-list')).not.toBeNull()
  })

  it("draws the production Settings pop-up inline in a collapsible group below the Track Map", async () => {
    const column = view().querySelector<HTMLElement>('.oa-rack')!
    const settings = column.querySelector<HTMLElement>('.ll-settings-window')!
    // After the Track Map, and before the Pop-ups & Dialogs group.
    const children = [...column.children]
    expect(children.findIndex(node => node.contains(settings))).toBe(children.findIndex(node => node.classList.contains('rv-lower-workspace')) + 1)
    const header = settings.querySelector<HTMLElement>(':scope > .drc-group > .drc-header')!
    expect(header.textContent).toContain('Settings')
    // The pop-up's own surface: title, close, the six sections and Sign Out.
    expect(settings.querySelector('.vsm-modal .vsm-title')?.textContent).toBe('SETTINGS')
    expect([...settings.querySelectorAll('.vsm-nav-item')].map(node => node.textContent)).toEqual(['Account', 'Appearance', 'Brand Kit', 'System Settings', 'DJ Software', 'Developer', 'Sign Out'])
    const open = async (label: string) => act(async () => [...settings.querySelectorAll<HTMLElement>('.vsm-nav-item')].find(node => node.textContent === label)!.click())
    // Account (the pop-up's first tab).
    expect(settings.querySelector('.vsm-nav-item--active')?.textContent).toBe('Account')
    expect([...settings.querySelectorAll('.vsm-acct-label')].map(node => node.textContent)).toEqual(['Email', 'Display Name', 'Artist Name'])
    expect(settings.querySelector('.vsm-acct-avatar-initials')?.textContent).toBe('KO')
    await open('Appearance')
    expect([...settings.querySelectorAll('.vsm-theme-card strong')].map(node => node.textContent)).toEqual(['Dark', 'Light', 'CDJ'])
    await open('System Settings')
    expect([...settings.querySelectorAll('.vsm-settings-group h2')].map(node => node.textContent)).toEqual(['Canvas Quality', 'Auto Quality', 'BPM Sync', 'Media Sync', 'Reset', 'Keyboard Shortcuts', 'Diagnostics'])
    await open('DJ Software')
    expect([...settings.querySelectorAll('.vsm-settings-group h2')].map(node => node.textContent)).toEqual(['DJ Software', 'Rekordbox Library Index'])
    expect(settings.querySelector('.vsm-dj-index-summary')?.textContent).toContain('2,418 tracks')
    await open('Developer')
    expect([...settings.querySelectorAll('.vsm-dev-panel [role="tab"]')].map(node => node.textContent)).toEqual(['Logging', 'Feature Flags', 'Network', 'Performance', 'Storage'])
    expect(settings.querySelectorAll('.vsm-dev-log-row').length).toBe(14)
    expect(settings.querySelector('.vsm-dev-log-row--collapsible')).not.toBeNull()
    // Close collapses the group, and the header expands it again.
    await act(async () => settings.querySelector<HTMLElement>('.vsm-close')!.click())
    expect(header.getAttribute('aria-expanded')).toBe('false')
    expect(settings.querySelector('.vsm-modal')).toBeNull()
    await act(async () => header.click())
    expect(settings.querySelector('.vsm-modal')).not.toBeNull()
  })

  it("draws every pop-up and confirmation dialog inline in a collapsible group below the Settings group", async () => {
    const column = view().querySelector<HTMLElement>('.oa-rack')!
    const popups = column.querySelector<HTMLElement>('.ll-popups-window')!
    expect(column.lastElementChild?.contains(popups)).toBe(true)
    const header = popups.querySelector<HTMLElement>(':scope > .drc-group > .drc-header')!
    expect(header.textContent).toContain('Pop-ups & Dialogs')
    const open = async (label: string) => act(async () => [...popups.querySelectorAll<HTMLElement>('[role="tab"]')].find(node => node.textContent === label)!.click())
    const titles = () => [...popups.querySelectorAll('.ll-popup-sample > figcaption strong')].map(node => node.textContent)

    // Confirmations: the shared ConfirmDialog with each caller's own copy, including the busy, notice and secondary-action variants.
    expect(titles()).toEqual([
      'Delete Media Item', 'Delete Media Items', 'Delete Media Item (working)', 'Delete Track', 'Delete Collection', 'Delete Pool', 'Delete Show',
      'Delete Show (deleting)', 'Change Section Engine?', 'Delete Deck', 'Delete Beam', 'Delete Beams', 'Delete Group', 'Camera Access Needed',
      'Unsaved changes', 'Unsaved changes (save failed)', 'Save As', 'Save As (failed)',
    ])
    expect(popups.querySelectorAll('.dv-confirm-dialog').length).toBe(18)
    expect(popups.querySelector('.dv-confirm-count-danger')?.textContent).toBe('3')
    expect(popups.querySelectorAll('.dv-confirm-dialog .dv-notice').length).toBeGreaterThanOrEqual(4)
    expect(popups.querySelector('.dv-confirm-icon--neutral')).not.toBeNull()

    await open('LYRIC MANAGER')
    expect(titles()).toEqual([
      'Delete Track', 'Delete Lyric Version', 'Replace active lyric version?', 'Unsaved lyric changes', 'This lyric version was changed elsewhere',
      'Recovered lyric draft available', 'Recovered lyric draft conflicts with the server',
    ])
    expect(popups.querySelectorAll('.lmv-dialog').length).toBe(2)
    expect(popups.querySelector('.lmv-recovery-review')).not.toBeNull()

    await open('EDITORS')
    expect(titles()).toEqual(['Edit Audio Metadata', 'Edit Audio Metadata (invalid)', 'New Collection', 'Edit Collection', 'Audio preview', 'Audio preview (loading)'])
    expect(popups.querySelectorAll('.mmv-editor-modal').length).toBe(6)
    expect(popups.querySelector<HTMLInputElement>('.mmv-editor-modal .mum-input')?.value).toBe('Neon Cathedral')

    await open('MENUS & PANELS')
    expect(titles()).toEqual(['Track actions menu', 'Library context menu (with submenu)', 'Cue point menu (existing cue)', 'Cue point menu (empty spot)', 'Notifications drawer', 'Info popover'])
    expect([...popups.querySelectorAll('.ll-popup-sample')[0]!.querySelectorAll('[role="menuitem"]')].map(node => node.textContent)).toEqual(['Open Active Lyrics', 'Make Open Version Active', 'Delete Track'])
    expect(popups.querySelectorAll('.vz-notifications-drawer .dv-notice')).toHaveLength(4)
    // The Notifications drawer closes and reopens.
    await act(async () => popups.querySelector<HTMLElement>('.vz-notifications-close')!.click())
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 600)) })
    expect(popups.querySelector('.vz-notifications-drawer')).toBeNull()

    // The group collapses from its header.
    await act(async () => header.click())
    expect(header.getAttribute('aria-expanded')).toBe('false')
    expect(popups.querySelector('.ll-popup-list')).toBeNull()
  })

  it('mounts no production rendering or media runtimes', () => {
    expect(container.querySelector('audio, video')).toBeNull()
    // The only canvases are Option A's dock scope, the Track Timeline rows and the Track Map beat grid and ruler, drawn from generated data.
    expect([...container.querySelectorAll('canvas')].every(canvas => canvas.closest('.oa-scopebay, .rv-timeline-lanes'))).toBe(true)
  })
})
