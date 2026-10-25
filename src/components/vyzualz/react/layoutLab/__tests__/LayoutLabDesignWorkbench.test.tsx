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

const DROPDOWNS = '[role="combobox"], [role="listbox"], [role="option"], select, .dv-underline-dropdown, .drm-dropdown'

describe('Layout Lab canvas', () => {
  it('has no dropdowns outside the Design A mockup windows, and none in designs B–E', () => {
    for (const id of ['design-01', 'design-02', 'design-03', 'design-04', 'design-05']) {
      const chrome = view(id)
      // Header group, navigation column, visualizer and dock never hold a dropdown.
      for (const selector of ['.fw-app-header', '.fw-app-navigation', '.rv-center-col', '.vz-transport-dock']) {
        expect(chrome.querySelector(`${selector} :is(${DROPDOWNS})`), `${id} ${selector}`).toBeNull()
      }
      if (id !== 'design-01') expect(chrome.querySelector(DROPDOWNS), id).toBeNull()
    }
  })

  it('mocks the Electric Storm source rail and the MARQUEE inspector in design A, and leaves B–E windows empty', () => {
    const left = view().querySelector<HTMLElement>('.vz-inspector--left')!
    const right = view().querySelector<HTMLElement>('.vz-inspector--right')!
    expect(left.querySelector('.rw-window-header-label')?.textContent).toBe('React Workspace')
    expect(left.querySelector('.rv-engine-dropdown-label')?.textContent).toBe('Cinema 2.0')
    expect(left.querySelector('.rv-engine-dropdown-preset')?.textContent).toBe('Electric Storm')
    expect([...left.querySelectorAll('.rv-context-workspace-tabs [role="tab"]')].map(tab => tab.textContent)).toEqual(['SOURCE', 'LAYERS'])
    expect(left.querySelector('.drc-header')?.textContent).toBe('Media Library')
    expect([...left.querySelectorAll('.vz-filter-tabs [role="tab"]')].map(tab => tab.textContent)).toEqual(['ALL', 'COLLECTIONS', 'FAVORITES', 'IMAGES', 'VIDEOS'])
    expect(left.querySelectorAll('.vz-media-card--sheet').length).toBeGreaterThanOrEqual(24)
    expect(left.querySelectorAll('.vz-media-card--active')).toHaveLength(1)

    expect(right.querySelector('.rw-window-header-label')?.textContent).toBe('Inspector')
    expect([...right.querySelectorAll('.rv-main-workspace-tabs [role="tab"]')].map(tab => tab.textContent)).toEqual(['PRESETS', 'DESIGN', 'REACT', 'AUDIO'])
    expect([...right.querySelectorAll('.rv-right-subtabs [role="tab"]')].map(tab => tab.textContent)).toEqual(['ENGINE', 'SELECTION'])
    // The four parent groups carry an icon; the nested Pattern / Marquee Copy / Lighting Zones groups do not.
    const headers = [...right.querySelectorAll<HTMLElement>('.drc-group > .drc-header')]
    expect(headers.filter(header => header.querySelector('.drc-header-icon')).map(header => header.textContent)).toEqual(['Master Controls', 'Design', 'Effects', 'Palette'])
    expect(headers.filter(header => !header.querySelector('.drc-header-icon')).map(header => header.textContent)).toEqual(['Pattern', 'Marquee Copy', 'Lighting Zones'])
    const labels = [...right.querySelectorAll('.rv-ctrl-label')].map(node => node.textContent)
    for (const label of ['Master Intensity', 'BPM Sync', 'Auto Performance', 'Camera Motion', 'Pattern', 'Pattern Change', 'Trigger', 'Front Marquee Text', 'Left Marquee Text', 'Right Marquee Text']) {
      expect(labels, label).toContain(label)
    }
    expect(right.querySelectorAll('.rv-cinema2-palette-body .rv-ctrl-row, .rv-cinema2-palette-body > *').length).toBeGreaterThan(0)
    expect(right.querySelector<HTMLInputElement>('input[value="DVYDRM B2B GOONZ"]')).not.toBeNull()

    for (const id of ['design-02', 'design-03', 'design-04', 'design-05']) {
      for (const side of ['left', 'right']) {
        const region = view(id).querySelector<HTMLElement>(`.vz-inspector--${side}`)!
        expect(region.textContent, `${id} ${side}`).toBe('')
      }
    }
  })

  it('mocks the Cinema 2.0 PRESETS tab and the Canvas REACT tab in design A\'s inspector', async () => {
    const right = view().querySelector<HTMLElement>('.vz-inspector--right')!
    const tab = (label: string) => [...right.querySelectorAll<HTMLButtonElement>('.rv-main-workspace-tabs [role="tab"]')].find(node => node.textContent === label)!

    await act(async () => tab('PRESETS').click())
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

    await act(async () => tab('REACT').click())
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

    await act(async () => tab('DESIGN').click())
    expect(right.querySelector('[data-cinema2-design-parent-groups]')).not.toBeNull()
  })

  it('shows the Audio Intelligence window with static, differing values in design A\'s AUDIO tab', async () => {
    const right = view().querySelector<HTMLElement>('.vz-inspector--right')!
    const audio = [...right.querySelectorAll<HTMLButtonElement>('.rv-main-workspace-tabs [role="tab"]')].find(node => node.textContent === 'AUDIO')!
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
    const column = view().querySelector<HTMLElement>('.rv-center-col')!
    expect([...column.children].map(node => node.className.split(' ')[0])).toEqual(['rv-canvas-wrap', 'rv-lower-workspace'])
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
    // Designs B–E have no workspace under their visualizer.
    expect(view('design-02').querySelector('.rv-lower-workspace')).toBeNull()
  })

  it('mirrors the production React audio dock in design A, with local-only controls', async () => {
    const dock = view().querySelector<HTMLElement>('.vz-transport-dock')!
    expect(dock.className).toContain('vz-transport-dock--expandable')
    expect([...dock.children].map(node => node.className)).toEqual(['vz-dock-region', 'vz-dock-region', 'vz-dock-region'])
    expect([...dock.querySelectorAll('.vz-dock-region > .vz-dock-card')].map(node => node.className.split(' ')[0])).toEqual(['vz-dock-left', 'vz-dock-center', 'vz-dock-right'])
    // The production keys, in production's order: no text labels on the icon-only keys.
    expect([...dock.querySelectorAll('.vz-dock-right-btns > button, .vz-dock-blank-group > button')].map(node => node.className.split(' ')[0])).toEqual([
      'vz-dock-tap-btn', 'vz-dock-cue-btn', 'vz-dock-sync-master-btn', 'vz-dock-playlist-trigger', 'vz-dock-track-timeline-btn',
    ])
    expect(dock.querySelector('.vz-dock-source-trigger')?.getAttribute('aria-label')).toBe('Audio source & Rekordbox')
    expect(dock.querySelector('.vz-dock-source-inline-name')?.textContent).toBe('Rekordbox')
    expect(dock.querySelector('.vz-dock-tap-label, .vz-dock-cue-label, .vz-dock-sync-master-label')).toBeNull()
    expect(dock.querySelector('.vz-dock-addtrack-btn span')?.textContent).toBe('Replace Track')
    // The waveform is production's deck canvas, not a drawing of bars.
    expect(dock.querySelector('.vz-dock-waveform-wrap .vz-peaks-wrap.vz-peaks-wrap--deck canvas')).not.toBeNull()
    expect(dock.querySelector('.rv-layout-lab-dock-waveform')).toBeNull()

    // Local state only: play toggles, the previous/next keys and the zoom keys honour their limits, SYNC toggles.
    const click = (selector: string) => act(async () => dock.querySelector<HTMLElement>(selector)!.click())
    expect(dock.querySelector('.az-play-btn')?.getAttribute('aria-label')).toBe('Play')
    await click('.az-play-btn')
    expect(dock.querySelector('.az-play-btn')?.getAttribute('aria-label')).toBe('Pause')
    await click('.vz-dock-track-nav-btn--previous')
    expect(dock.querySelector<HTMLButtonElement>('.vz-dock-track-nav-btn--previous')!.disabled).toBe(true)
    expect(dock.querySelector('.vz-dock-track-title')?.textContent).toContain('Mocha ID')
    expect(dock.querySelector<HTMLButtonElement>('.vz-dock-zoom-btns button:last-child')!.disabled).toBe(true)
    await click('.vz-dock-sync-master-btn')
    expect(dock.querySelector('.vz-dock-sync-master-btn')?.classList.contains('vz-dock-sync-master-btn--on')).toBe(false)
    // Clicking empty dock space collapses it, as in production.
    await act(async () => dock.click())
    expect(dock.classList.contains('vz-transport-dock--collapsed')).toBe(true)
    await act(async () => dock.click())

    // Designs B–E keep the older dock mockup.
    expect(view('design-02').querySelector('.vz-dock-source-trigger')).toBeNull()
  })

  it('mocks the React header elements in design A\'s header group and leaves B–E empty', () => {
    const header = view().querySelector<HTMLElement>('.fw-app-header-surface')!
    expect(header.querySelector('.az-logo-mark')?.textContent).toBe('DRMVYZ')
    expect(header.querySelector('.fw-app-header-controls > .vz-header[data-react-header-controls]')).not.toBeNull()
    expect(header.querySelector('.vz-header-group')?.getAttribute('aria-label')).toBe('React controls')
    expect([...header.querySelectorAll('.rv-global-output button')].map(button => button.getAttribute('aria-label'))).toEqual(['OUTPUT PREVIEW', 'Reveal output', 'Blackout output'])
    expect(header.querySelector('button[aria-label="Layout Lab"]')).not.toBeNull()
    expect([...header.querySelectorAll('.rv-header-status-stack')].map(stack => stack.getAttribute('data-header-stack'))).toEqual(['loading+saved', 'fps+frame-time', 'quality+cpu'])
    expect(header.querySelector('button[aria-label="Notifications"]')).not.toBeNull()
    expect(header.querySelector('.vz-header-avatar')).not.toBeNull()
    // The mockup shows fixed readings, with no controls that act on anything.
    for (const label of ['SAVED', 'FPS', 'FRAME TIME', 'QUALITY', 'CPU']) expect(header.textContent?.toUpperCase()).toContain(label)
    for (const id of ['design-02', 'design-03', 'design-04', 'design-05']) {
      expect(view(id).querySelector('.fw-app-header-surface')!.textContent, id).toBe('')
    }
  })

  it('is a left window, a visualizer and a right window above the audio dock, with an empty visualizer', () => {
    const active = view()
    const left = active.querySelector<HTMLElement>('.vz-inspector--left')!
    const right = active.querySelector<HTMLElement>('.vz-inspector--right')!
    const visualizer = active.querySelector<HTMLElement>('.rv-canvas-wrap')!
    expect(left.getAttribute('aria-label')).toBe('Layout Lab left window')
    expect(right.getAttribute('aria-label')).toBe('Layout Lab right window')
    expect(visualizer.getAttribute('aria-label')).toBe('Layout Lab visualizer')
    for (const region of [left, right]) expect(region.querySelector('.vz-inspector-inner')).not.toBeNull()
    expect(visualizer.childElementCount).toBe(0)
    expect(visualizer.textContent).toBe('')

    // Same frame, shell and rail classes as production, so the sizes come from the same CSS.
    expect(active.matches('[data-workspace-layout="floating"][data-app-workspace="react"].fw-app-frame') ? active : null).not.toBeNull()
    expect(active.querySelector('.fw-app-content .vz-main .rv-shell.rv-shell--floating > .rv-layout')).not.toBeNull()
    expect(left.classList.contains('rw-frame--left') && right.classList.contains('rw-frame--right')).toBe(true)
    // A blank header group across the top and a blank navigation column on the left, both empty.
    const header = active.querySelector<HTMLElement>('.fw-app-header > .fw-app-header-surface')!
    const nav = active.querySelector<HTMLElement>('.fw-app-navigation > .az-sidebar')!
    expect(header.getAttribute('aria-label')).toBe('Layout Lab header group')
    expect(nav.getAttribute('aria-label')).toBe('Layout Lab navigation column')
    // Design A carries the production navigation options and footer, with the A–E switcher between them.
    expect([...nav.children].map(node => node.className)).toEqual(['az-nav', 'll-design-switcher', 'az-sidebar-footer'])
    expect([...nav.querySelectorAll('.az-nav-item')].map(item => item.getAttribute('aria-label'))).toEqual(['React', 'Preset Manager', 'Show Manager', 'Lyric Manager', 'Media Manager'])
    expect(nav.querySelector('.az-nav-section-label')?.textContent).toBe('Managers')
    expect(nav.querySelector('.az-nav-item--active')?.getAttribute('aria-label')).toBe('React')
    expect(nav.querySelector('.az-sidebar-footer')?.textContent).toContain('Professional')
    // The other designs' navigation columns are empty apart from the switcher.
    for (const id of ['design-02', 'design-03', 'design-04', 'design-05']) {
      expect([...view(id).querySelector('.fw-app-navigation > .az-sidebar')!.children].map(node => node.className), id).toEqual(['ll-design-switcher'])
    }
    const frame = active.querySelector('.fw-app-shell')!
    expect([...frame.children].map(node => node.className.split(' ')[0])).toEqual(['fw-region', 'fw-app-body'])
    expect(active.querySelector('.fw-app-body')!.firstElementChild).toBe(active.querySelector('.fw-app-navigation'))

    const layout = active.querySelector('.rv-layout')!
    expect([...layout.children].map(node => node.className.split(' ')[0])).toEqual(['vz-inspector', 'rv-center-col', 'vz-inspector'])
    const dock = active.querySelector('.vz-transport-dock')!
    expect(dock).not.toBeNull()
    expect(layout.contains(dock)).toBe(false)
    expect(dock.previousElementSibling).toBe(layout)
  })

  it('switches between five independent designs with the A–E buttons', async () => {
    const ids = ['design-01', 'design-02', 'design-03', 'design-04', 'design-05']
    expect([...container.querySelectorAll('[data-lab-design]')].map(node => node.getAttribute('data-lab-design'))).toEqual(ids)
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
    // Hidden designs keep their own dock state: toggling playback in one does not touch another.
    const playButton = (id: string) => view(id).querySelector<HTMLButtonElement>('.az-play-btn')!
    const before = playButton('design-02').getAttribute('aria-label')
    await act(async () => playButton('design-01').click())
    expect(playButton('design-02').getAttribute('aria-label')).toBe(before)
  })

  it('mounts no production rendering or media runtimes', () => {
    expect(container.querySelector('audio, video')).toBeNull()
    // The only canvases are design A's dock waveform and Track Map beat grid and ruler, drawn from generated data.
    expect([...container.querySelectorAll('canvas')].every(canvas => canvas.closest('.vz-dock-waveform-wrap, .rv-timeline-lanes'))).toBe(true)
  })
})
