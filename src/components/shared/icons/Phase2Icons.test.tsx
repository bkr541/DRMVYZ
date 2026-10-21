// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getReactEngineIconComponent } from '../../vyzualz/react/reactEngineIcons'
import { REACT_KNOWN_ENGINE_IDS } from '../../vyzualz/react/reactEngineCatalog'
import { FIXTURE_ICON_KINDS, LaserDmxShowDirectorFixtureIcon } from '../../vyzualz/react/LaserDmxShowDirectorFixtureIcon'
import { FixtureIcon } from '../../vyzualz/react/LaserDmxShowDirectorPalette'
import { TrackTimelineIcon } from '../../vyzualz/react/trackTimeline/TrackTimelineIcon'

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

describe('phase 2 production icon integration', () => {
  it('covers every current and compatibility engine with decorative approved artwork', async () => {
    await act(async () => root.render(<>{REACT_KNOWN_ENGINE_IDS.map(id => {
      const Icon = getReactEngineIconComponent(id)
      return <div key={id} data-engine={id}><Icon /></div>
    })}</>))
    const kinds = [...container.querySelectorAll('svg')].map(icon => icon.getAttribute('data-app-icon'))
    expect(kinds).toEqual(['shader', 'orbit', 'cinema', 'cinema', 'waveform', 'canvas', 'laser', 'pixGrid', 'headliner'])
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(REACT_KNOWN_ENGINE_IDS.length)
  })

  it('uses identical fixture drawings in the palette and stage while retaining fixture color and sizing', async () => {
    const kinds = Object.keys(FIXTURE_ICON_KINDS) as Array<keyof typeof FIXTURE_ICON_KINDS>
    await act(async () => root.render(<>{kinds.map(kind => (
      <div key={kind}>
        <FixtureIcon kind={kind} />
        <LaserDmxShowDirectorFixtureIcon kind={kind} color="#ff0099" className="fixture-preview" style={{ opacity: 0.6 }} />
      </div>
    ))}</>))
    for (const pair of container.children) {
      const [palette, stage] = pair.querySelectorAll('svg')
      expect(palette.getAttribute('data-app-icon')).toBe(stage.getAttribute('data-app-icon'))
      expect([...palette.querySelectorAll('path')].map(path => path.getAttribute('d')))
        .toEqual([...stage.querySelectorAll('path')].map(path => path.getAttribute('d')))
      const wrapper = pair.querySelector<HTMLElement>('.fixture-preview')!
      expect(wrapper.style.color).toBe('rgb(255, 0, 153)')
      expect(wrapper.style.getPropertyValue('--app-icon-accent')).toBe('currentColor')
      expect(wrapper.style.opacity).toBe('0.6')
      expect(stage.getAttribute('width')).toBe('100%')
      expect(stage.style.height).toBe('100%')
      expect(pair.querySelector('img')).toBeNull()
    }
  })

  it('retains the timeline wrapper while replacing the raw SVG asset with approved artwork', async () => {
    await act(async () => root.render(<TrackTimelineIcon />))
    expect(container.querySelector('.track-timeline-icon [data-app-icon="timeline"]')).not.toBeNull()
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 32 32')
  })
})
