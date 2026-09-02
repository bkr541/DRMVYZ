// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CINEMATIC_WORLD_CATALOG,
  CINEMATIC_WORLD_CATALOG_LIST,
  isAccessibilitySafeCinematicControlId,
  updateCinematicWorldSettings,
  validateCinematicWorldControlSchema,
  type AnyCinematicWorldControlSchema,
  type CinematicWorldIntegerControl,
  type CinematicWorldSelectControl,
} from '../CinematicWorldControlSchema'
import {
  CINEMATIC_WORLD_MODES,
  createCinematicWorldConfig,
  normalizeCinematicWorldConfig,
  type CinematicWorldMode,
} from '../CinematicWorldConfig'
import {
  ANCIENT_MACHINE_BOUNDS,
  CELESTIAL_CATHEDRAL_BOUNDS,
  ELECTRIC_STORM_BOUNDS,
  ELECTRIC_STORM_DEFAULTS,
  EVENT_HORIZON_BOUNDS,
  FRACTURE_RIFT_BOUNDS,
  INFINITE_CORRIDOR_BOUNDS,
  LIQUID_MEMBRANE_BOUNDS,
  MIRROR_DIMENSION_BOUNDS,
  MONOLITH_GATE_BOUNDS,
  REACTIVE_CONSTELLATION_BOUNDS,
  REACTIVE_CONSTELLATION_DEFAULTS,
  REACTIVE_CONSTELLATION_MACRO_KEYS,
  STORM_GATEWAY_BOUNDS,
  createDefaultCinematicWorldSettings,
  type CinematicWorldSpecificConfig,
} from '../CinematicWorldSettings'
import { CinematicWorldControlSchemaRenderer } from '../CinematicWorldsControls'

let container: HTMLElement
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

async function render(node: React.ReactNode) {
  await act(async () => root.render(node))
}

const BOUNDS_BY_MODE: Partial<Record<CinematicWorldMode, Record<string, readonly [number, number]>>> = {
  eventHorizon: EVENT_HORIZON_BOUNDS,
  infiniteCorridor: INFINITE_CORRIDOR_BOUNDS,
  fractureRift: FRACTURE_RIFT_BOUNDS,
  monolithGate: MONOLITH_GATE_BOUNDS,
  liquidMembrane: LIQUID_MEMBRANE_BOUNDS,
  celestialCathedral: CELESTIAL_CATHEDRAL_BOUNDS,
  mirrorDimension: MIRROR_DIMENSION_BOUNDS,
  ancientMachine: ANCIENT_MACHINE_BOUNDS,
  stormGateway: STORM_GATEWAY_BOUNDS,
}

describe('Cinematic World control schema', () => {
  it('validates every catalog schema and exposes accessibility-safe, unique IDs', () => {
    expect(CINEMATIC_WORLD_CATALOG_LIST).toHaveLength(CINEMATIC_WORLD_MODES.length)
    for (const entry of CINEMATIC_WORLD_CATALOG_LIST) {
      const schema = entry.controls as AnyCinematicWorldControlSchema
      expect(validateCinematicWorldControlSchema(schema), entry.id).toEqual([])
      const ids = schema.groups.flatMap(group => [group.id, ...group.controls.map(control => control.id)])
      expect(new Set(ids).size, entry.id).toBe(ids.length)
      expect(ids.every(isAccessibilitySafeCinematicControlId), entry.id).toBe(true)
      expect(schema.groups.every(group => group.label.trim().length > 0), entry.id).toBe(true)
      expect(schema.groups.flatMap(group => group.controls).every(control => control.label.trim().length > 0), entry.id).toBe(true)
    }

    const invalid: AnyCinematicWorldControlSchema = {
      mode: 'eventHorizon',
      groups: [{
        id: 'bad group id',
        label: '',
        controls: [{ kind: 'select', id: 'duplicate', setting: 'fit', label: 'Fit', options: [] }],
      }, {
        id: 'duplicate',
        label: 'Duplicate',
        controls: [{ kind: 'toggle', id: 'duplicate', setting: 'missing', label: 'Missing' }],
      }],
    }
    expect(validateCinematicWorldControlSchema(invalid)).toEqual(expect.arrayContaining([
      expect.stringContaining('accessibility-safe'),
      expect.stringContaining('missing a label'),
      expect.stringContaining('Duplicate control schema id'),
      expect.stringContaining('unknown setting'),
      expect.stringContaining('at least one option'),
    ]))
  })

  it('keeps all existing numeric defaults and bounds wired without changing their values', () => {
    for (const [mode, bounds] of Object.entries(BOUNDS_BY_MODE) as [CinematicWorldMode, Record<string, readonly [number, number]>][]) {
      const schema = CINEMATIC_WORLD_CATALOG[mode].controls as AnyCinematicWorldControlSchema
      const defaults = createDefaultCinematicWorldSettings(mode).settings as unknown as Record<string, unknown>
      const controls = schema.groups.flatMap(group => group.controls)
      expect(controls).toHaveLength(Object.keys(bounds).length)
      for (const control of controls) {
        expect(control.kind === 'slider' || control.kind === 'integer', `${mode}.${control.setting}`).toBe(true)
        if (control.kind !== 'slider' && control.kind !== 'integer') continue
        expect([control.min, control.max], `${mode}.${control.setting}`).toEqual(bounds[control.setting])
        const value = defaults[control.setting]
        expect(typeof value, `${mode}.${control.setting}`).toBe('number')
        expect(value as number, `${mode}.${control.setting}`).toBeGreaterThanOrEqual(control.min)
        expect(value as number, `${mode}.${control.setting}`).toBeLessThanOrEqual(control.max)
        if (control.kind === 'integer') expect(Number.isInteger(value), `${mode}.${control.setting}`).toBe(true)
      }
    }
  })

  it('exposes the Electric Storm Design controls with canonical midpoint defaults and existing color inputs', async () => {
    const schema = CINEMATIC_WORLD_CATALOG.electricStorm.controls
    const controls = schema.groups.flatMap(group => group.controls)
    expect(controls.map(control => control.setting)).toEqual([
      'backgroundColor', 'lightningColor', 'masterIntensity', 'strikeRate', 'branching', 'thickness', 'glow', 'impactShake', 'zoomPunch',
    ])
    expect(controls.filter(control => control.kind === 'color').map(control => control.setting)).toEqual(['backgroundColor', 'lightningColor'])
    expect(controls.filter(control => control.kind === 'slider')).toHaveLength(Object.keys(ELECTRIC_STORM_BOUNDS).length)

    const config = createCinematicWorldConfig('electricStorm', {})
    expect(config.worldSettings.settings).toEqual(ELECTRIC_STORM_DEFAULTS)
    const onChange = vi.fn()
    await render(
      <CinematicWorldControlSchemaRenderer
        config={config}
        schema={schema}
        uiMode="simple"
        onChange={onChange}
      />,
    )

    const background = container.querySelector('#electric-storm-background-color') as HTMLInputElement
    const lightning = container.querySelector('#electric-storm-lightning-color') as HTMLInputElement
    const intensity = container.querySelector('#electric-storm-master-intensity') as HTMLInputElement
    const impactShake = container.querySelector('#electric-storm-impact-shake') as HTMLInputElement
    const zoomPunch = container.querySelector('#electric-storm-zoom-punch') as HTMLInputElement
    expect(background.type).toBe('color')
    expect(background.value).toBe('#000000')
    expect(lightning.type).toBe('color')
    expect(lightning.value).toBe(ELECTRIC_STORM_DEFAULTS.lightningColor)
    expect(intensity.type).toBe('range')
    expect(intensity.value).toBe('0.5')
    expect(impactShake.value).toBe('0.5')
    expect(zoomPunch.value).toBe('0.5')
  })

  it('renders slider, integer, and select controls with labels, descriptions, and stable IDs', async () => {
    const onChange = vi.fn()
    const eventConfig = createCinematicWorldConfig('eventHorizon', {})
    await render(
      <CinematicWorldControlSchemaRenderer
        config={eventConfig}
        schema={CINEMATIC_WORLD_CATALOG.eventHorizon.controls}
        uiMode="advanced"
        onChange={onChange}
      />,
    )

    const slider = container.querySelector('#cinematic-world-setting-coreRadius') as HTMLInputElement
    const integer = container.querySelector('#cinematic-world-setting-depthLayers') as HTMLInputElement
    expect(slider.type).toBe('range')
    expect(slider.step).toBe('0.005')
    expect(integer.type).toBe('range')
    expect(integer.step).toBe('1')
    expect((container.querySelector('label[for="cinematic-world-setting-coreRadius"]') as HTMLLabelElement).textContent).toBe('Core Radius')

    const constellationConfig = createCinematicWorldConfig('reactiveConstellation', {})
    await render(
      <CinematicWorldControlSchemaRenderer
        config={constellationConfig}
        schema={CINEMATIC_WORLD_CATALOG.reactiveConstellation.controls}
        uiMode="advanced"
        onChange={onChange}
      />,
    )

    const select = container.querySelector('#constellation-topology-style') as HTMLButtonElement
    expect(select).toBeInstanceOf(HTMLButtonElement)
    expect(select.textContent).toContain('Cluster')
  })

  it('preserves discriminated modes while clamping integers and validating select and toggle values', () => {
    const monolith = createDefaultCinematicWorldSettings('monolithGate') as Extract<CinematicWorldSpecificConfig, { mode: 'monolithGate' }>
    const columnCount = CINEMATIC_WORLD_CATALOG.monolithGate.controls.groups
      .flatMap(group => group.controls)
      .find(control => control.setting === 'columnCount') as CinematicWorldIntegerControl<'monolithGate'>
    const updatedMonolith = updateCinematicWorldSettings(monolith, columnCount, 6.7)
    expect(updatedMonolith.mode).toBe('monolithGate')
    expect(updatedMonolith.settings.columnCount).toBe(7)
    expect('coreRadius' in updatedMonolith.settings).toBe(false)

    const constellation = createDefaultCinematicWorldSettings('reactiveConstellation') as Extract<CinematicWorldSpecificConfig, { mode: 'reactiveConstellation' }>
    const constellationControls = CINEMATIC_WORLD_CATALOG.reactiveConstellation.controls.groups.flatMap(group => group.controls)
    const topology = constellationControls.find(control => control.setting === 'topologyStyle') as CinematicWorldSelectControl<'reactiveConstellation'>
    expect(updateCinematicWorldSettings(constellation, topology, 'future').settings.topologyStyle).toBe(REACTIVE_CONSTELLATION_DEFAULTS.topologyStyle)
    expect(updateCinematicWorldSettings(constellation, topology, 'chain').settings.topologyStyle).toBe('chain')
  })

  it('exposes only implemented Reactive Constellation controls and preserves typed selections', async () => {
    const schema = CINEMATIC_WORLD_CATALOG.reactiveConstellation.controls
    const controls = schema.groups.flatMap(group => group.controls)
    const numericControls = controls.filter(control => control.kind === 'slider' || control.kind === 'integer')
    const selectControls = controls.filter(control => control.kind === 'select')

    expect(controls.map(control => control.setting)).toEqual([
      'nodeCount', 'topologyStyle', 'polyhedronStyle', 'networkSpread', 'nodeScale',
      'beamWidth', 'edgeOpacity', 'trailSamples', 'beamFanAmount',
      'beamCoreBrightness', 'beamGlow', 'trailDecay', 'trailSpacing',
      'depthSpread', 'neighborCount', 'nodeScaleVariation', 'centralGravity',
      'springStrength', 'damping', 'elasticity', 'topologyStability', 'driftAmount',
      'turbulence', 'orbitAmount',
      'initialExpansion', 'expansionTarget', 'expansionAttackSec', 'expansionReleaseSec',
      'expansionSpringStrength', 'expansionDamping', 'expansionOvershoot', 'radialStaggerSec',
      'expansionBurstImpulse', 'collapseAmount', 'burstStrength', 'reseedEveryBars',
      'backgroundCurtains', 'curtainDensity', 'depthFade',
      'faceOpacity', 'facetContrast', 'internalGlow', 'rimIntensity', 'wireframeAmount',
      'colorVariation', 'nodeSpin', 'cameraOrbit',
    ])
    expect(controls.some(control => /trail|beam/i.test(String(control.setting)))).toBe(true)
    expect(controls.some(control => /audio/i.test(String(control.setting)))).toBe(false)
    expect(selectControls.map(control => control.setting)).toEqual(['topologyStyle', 'polyhedronStyle'])
    expect(numericControls).toHaveLength(Object.keys(REACTIVE_CONSTELLATION_BOUNDS).length - REACTIVE_CONSTELLATION_MACRO_KEYS.length)
    for (const control of numericControls) {
      if (control.kind !== 'slider' && control.kind !== 'integer') continue
      expect([control.min, control.max]).toEqual(REACTIVE_CONSTELLATION_BOUNDS[control.setting])
    }

    const config = createCinematicWorldConfig('reactiveConstellation', {})
    await render(
      <CinematicWorldControlSchemaRenderer
        config={config}
        schema={schema}
        uiMode="advanced"
        onChange={vi.fn()}
      />,
    )
    expect(container.querySelector('#constellation-node-count')).toBeInstanceOf(HTMLInputElement)
    expect(container.querySelector('#constellation-topology-style')).toBeInstanceOf(HTMLButtonElement)
    expect(container.querySelector('#constellation-camera-orbit')).toBeInstanceOf(HTMLInputElement)
    expect(container.querySelector('#constellation-beam-width')).toBeInstanceOf(HTMLInputElement)
    expect(container.querySelector('#constellation-trail-samples')).toBeInstanceOf(HTMLInputElement)
    expect(container.querySelector('#constellation-facet-contrast')).toBeInstanceOf(HTMLInputElement)
    expect(container.querySelector('#constellation-background-curtains')).toBeInstanceOf(HTMLInputElement)
    expect(container.querySelector('#constellation-initial-expansion')).toBeInstanceOf(HTMLInputElement)
    expect(container.querySelector('#constellation-expansion-overshoot')).toBeInstanceOf(HTMLInputElement)

    await render(
      <CinematicWorldControlSchemaRenderer
        config={config}
        schema={schema}
        uiMode="simple"
        onChange={vi.fn()}
      />,
    )
    expect(container.querySelector('#constellation-node-count')).toBeNull()

    const settings = createDefaultCinematicWorldSettings('reactiveConstellation') as Extract<CinematicWorldSpecificConfig, { mode: 'reactiveConstellation' }>
    const nodeCount = controls.find(control => control.setting === 'nodeCount') as CinematicWorldIntegerControl<'reactiveConstellation'>
    const topology = controls.find(control => control.setting === 'topologyStyle') as CinematicWorldSelectControl<'reactiveConstellation'>
    expect(updateCinematicWorldSettings(settings, nodeCount, 200).settings.nodeCount).toBe(96)
    expect(updateCinematicWorldSettings(settings, topology, 'chain').settings.topologyStyle).toBe('chain')
    expect(updateCinematicWorldSettings(settings, topology, 'future').settings.topologyStyle).toBe(REACTIVE_CONSTELLATION_DEFAULTS.topologyStyle)
  })

  it('normalizes persisted configuration safely and preserves the existing compatibility extension strategy', () => {
    const normalized = normalizeCinematicWorldConfig({
      worldMode: 'monolithGate',
      worldSettings: {
        mode: 'monolithGate',
        settings: { columnCount: 6.8, ringCount: -4, architectureStyle: 99, futureWorldField: 'nebula' },
      },
      compatibility: { extensions: { 'worldSettings.futureWorldField': 'nebula' } },
      futureRootField: { enabled: true },
    })

    expect(normalized.worldSettings.mode).toBe('monolithGate')
    if (normalized.worldSettings.mode !== 'monolithGate') throw new Error('Expected monolith settings')
    expect(normalized.worldSettings.settings).toMatchObject({ columnCount: 7, ringCount: 0, architectureStyle: 2 })
    expect('futureWorldField' in normalized.worldSettings.settings).toBe(false)
    expect(normalized.compatibility.extensions['worldSettings.futureWorldField']).toBe('nebula')
    expect(normalized.compatibility.extensions.futureRootField).toEqual({ enabled: true })
  })

  it('migrates retired Media Portal configs to Legacy Portal compatibility', () => {
    const normalized = normalizeCinematicWorldConfig({
      worldMode: 'mediaPortal',
      worldSettings: {
        mode: 'mediaPortal',
        settings: { sourceMediaId: 'asset-123', sourceLabel: 'Logo', fit: 'cover' },
      },
      audioMapping: { routes: [] },
    })

    expect(normalized.worldMode).toBe('legacyPortal')
    expect(normalized.worldSettings.mode).toBe('legacyPortal')
    expect(normalized.audioMapping.routes).toEqual([])
  })
})
