// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { PRIORITY_ONE_HELP_ENTRIES } from '../../../help/HelpCenter'
import { bindPriorityHelpActivation, resolvePriorityOneHelpMatches } from './PriorityOneHelpLayer'

function entries(...ids: string[]) {
  return PRIORITY_ONE_HELP_ENTRIES.filter(entry => ids.includes(entry.id))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PriorityOneHelpLayer matching', () => {
  it('selects the active React engine entry when labels repeat across engines', () => {
    document.body.innerHTML = `
      <div class="rv-shell" data-help-engine="canvas">
        <div class="rv-ctrl-row"><span class="rv-ctrl-label">Auto Performance</span><button role="switch"></button></div>
      </div>
    `
    const root = document.querySelector('.rv-shell')!
    const matches = resolvePriorityOneHelpMatches(root, entries(
      'react.soundDrawing.authoredPerformance.autoPerformance',
      'react.canvas.performanceOrchestration.autoPerformance',
      'react.pixGrid.performanceAndMatrix.performance.autoPerformance',
    ))

    expect(matches).toHaveLength(1)
    expect(matches[0].entry.id).toBe('react.canvas.performanceOrchestration.autoPerformance')
  })

  it('uses inspector context to distinguish repeated timeline labels', () => {
    document.body.innerHTML = `
      <div class="az-shell">
        <div class="vz-ml-insp-body" data-help-context="Timeline Overlay Clip Inspector">
          <div class="vz-ml-insp-group-hd"><span class="vz-ml-insp-group-title">Info</span></div>
          <div class="vz-ml-insp-row"><span class="vz-ml-insp-lbl">Dur (s)</span><input type="number" /></div>
        </div>
      </div>
    `
    const root = document.querySelector('.az-shell')!
    const matches = resolvePriorityOneHelpMatches(root, entries(
      'visualizer.timeline.backgroundClip.info.overview',
      'visualizer.timeline.overlayClip.info.overview',
      'visualizer.timeline.effectRegion.info.overview',
      'visualizer.timeline.backgroundClip.info.durationSeconds',
      'visualizer.timeline.overlayClip.info.durationSeconds',
      'visualizer.timeline.effectRegion.info.durationSeconds',
    ))
    const ids = matches.map(match => match.entry.id)

    expect(ids).toContain('visualizer.timeline.overlayClip.info.overview')
    expect(ids).toContain('visualizer.timeline.overlayClip.info.durationSeconds')
    expect(ids).not.toContain('visualizer.timeline.backgroundClip.info.overview')
  })

  it('matches current accessible labels when the audit title is conceptual', () => {
    document.body.innerHTML = `
      <div class="az-shell">
        <div class="vz-layer-item-header">
          <button aria-label="Hide Background layer" title="Hide layer"></button>
          <span class="vz-slider-label">Background</span>
        </div>
      </div>
    `
    const root = document.querySelector('.az-shell')!
    const matches = resolvePriorityOneHelpMatches(root, entries(
      'visualizer.layers.rendering.backgroundLayer',
      'visualizer.layers.rendering.visibility',
    ))
    const ids = matches.map(match => match.entry.id)

    expect(ids).toContain('visualizer.layers.rendering.backgroundLayer')
    expect(ids).toContain('visualizer.layers.rendering.visibility')
  })

  it('activates only the injected icon owned by the hovered control when slots share a host', () => {
    vi.useFakeTimers()
    const host = document.createElement('div')
    const firstButton = document.createElement('button')
    const firstLabel = document.createElement('span')
    firstLabel.textContent = 'Text'
    firstButton.appendChild(firstLabel)
    const secondButton = document.createElement('button')
    const secondLabel = document.createElement('span')
    secondLabel.textContent = 'SVG'
    secondButton.appendChild(secondLabel)
    const firstSlot = document.createElement('span')
    const secondSlot = document.createElement('span')
    host.append(firstButton, secondButton, firstSlot, secondSlot)
    document.body.appendChild(host)

    const disposeFirst = bindPriorityHelpActivation(firstSlot, firstLabel, host)
    const disposeSecond = bindPriorityHelpActivation(secondSlot, secondLabel, host)

    firstButton.dispatchEvent(new Event('pointerenter'))
    expect(firstSlot.dataset.active).toBe('true')
    expect(secondSlot.dataset.active).toBe('false')

    firstButton.dispatchEvent(new Event('pointerleave'))
    vi.advanceTimersByTime(120)
    expect(firstSlot.dataset.active).toBe('false')

    secondButton.dispatchEvent(new Event('pointerenter'))
    expect(firstSlot.dataset.active).toBe('false')
    expect(secondSlot.dataset.active).toBe('true')

    disposeFirst()
    disposeSecond()
    vi.useRealTimers()
  })

  it('does not duplicate an explicitly wired help trigger', () => {
    document.body.innerHTML = `
      <div class="rv-shell" data-help-engine="oscilloscope">
        <div class="rv-ctrl-row">
          <span class="rv-ctrl-label">Complexity</span>
          <button class="drm-help-info-trigger" data-help-id="react.soundDrawing.showChoreography.complexity"></button>
        </div>
      </div>
    `
    const root = document.querySelector('.rv-shell')!
    const matches = resolvePriorityOneHelpMatches(root, entries(
      'react.soundDrawing.showChoreography.complexity',
    ))

    expect(matches).toHaveLength(0)
  })
  it('reconciles every Priority 1 registry entry inside its declared view, engine, and group context', () => {
    const engineIds: Record<string, string> = {
      shared: 'oscilloscope',
      soundDrawing: 'oscilloscope',
      cinematicWorlds: 'cinematicPortal',
      shaderPads: 'shaderPads',
      canvas: 'canvas',
      laserDmx: 'laserDmx',
      'laserDmx.beamMatrix': 'laserDmx',
      'laserDmx.showDirector': 'laserDmx',
      pixGrid: 'pixGrid',
    }

    for (const view of ['react', 'visualizer', 'lyricManager', 'mediaManager'] as const) {
      const viewEntries = PRIORITY_ONE_HELP_ENTRIES.filter(entry => entry.view === view)
      const root = document.createElement('div')
      root.className = view === 'react' ? 'rv-shell' : view === 'visualizer' ? 'az-shell' : view === 'lyricManager' ? 'lmv-root' : 'mmv-root'
      for (const entry of viewEntries) {
        const context = document.createElement('div')
        context.dataset.helpContext = entry.group
        if ('engine' in entry && entry.engine) {
          context.dataset.helpEngine = engineIds[entry.engine] ?? entry.engine
        }
        const label = document.createElement('span')
        label.className = 'test-control-label'
        label.textContent = entry.title
        context.appendChild(label)
        root.appendChild(context)
      }
      document.body.appendChild(root)

      const matches = resolvePriorityOneHelpMatches(root, viewEntries)
      expect(new Set(matches.map(match => match.entry.id)).size).toBe(viewEntries.length)
      root.remove()
    }
  })

})
