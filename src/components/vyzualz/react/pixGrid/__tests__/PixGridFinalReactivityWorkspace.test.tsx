// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useReactStore } from '../../../../../stores/reactStore'
import { ReactReactivityWorkspacePanel } from '../../panels/ReactWorkspacePanels'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { PixGridPerformanceProgramCompiler } from '../PixGridPerformanceProgramCompiler'
import { BASS_BEACON_PERFORMANCE_PROGRAM } from '../PixGridPerformancePrograms'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { applyPixGridPresetSettings } from '../PixGridState'
import type { PixGridState } from '../PixGridTypes'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('pixGrid')
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function renderWorkspace() {
  await act(async () => root.render(<ReactReactivityWorkspacePanel />))
}

function button(text: string): HTMLButtonElement {
  const result = [...container.querySelectorAll('button')].find(candidate => candidate.textContent?.trim() === text)
  if (!result) throw new Error(`Missing button: ${text}`)
  return result as HTMLButtonElement
}

function stateForBassBeacon() {
  const preset = PIX_GRID_PRESET_BY_ID.get('pix-grid-bass-beacon')!
  return applyPixGridPresetSettings(createDefaultPixGridState(), preset.id, preset.pixGridSettings)
}

describe('PixGrid final Reactivity workspace', () => {
  it('exposes native Routing, Events, Choreography, and Analysis tabs without replacing the center visualizer', async () => {
    await renderWorkspace()
    expect(button('ROUTING').getAttribute('aria-selected')).toBe('true')
    expect(button('EVENTS')).toBeTruthy()
    expect(button('CHOREOGRAPHY')).toBeTruthy()
    expect(button('ANALYSIS')).toBeTruthy()
    expect(container.querySelector('[data-testid="pix-grid-continuous-workspace"]')).not.toBeNull()

    await act(async () => button('EVENTS').click())
    expect(container.querySelector('[data-testid="pix-grid-event-workspace"]')).not.toBeNull()
    await act(async () => button('CHOREOGRAPHY').click())
    expect(container.querySelector('[data-testid="pix-grid-choreography-workspace"]')).not.toBeNull()
    expect(container.textContent).toContain('Auto Performance')
    expect(container.textContent).toContain('Performance Intensity')
    expect(button('Clear Override')).toBeTruthy()
    await act(async () => button('ANALYSIS').click())
    expect(container.querySelector('[data-testid="pix-grid-analysis-workspace"]')).not.toBeNull()
    expect(container.querySelector('canvas')).toBeNull()
  })

  it('duplicates a shipped preset route into an editable user route', async () => {
    await renderWorkspace()
    const before = useReactStore.getState().pixGridState.audioAssignments.length
    await act(async () => button('Duplicate').click())
    const assignments = useReactStore.getState().pixGridState.audioAssignments
    expect(assignments).toHaveLength(before + 1)
    expect(assignments[assignments.length - 1]?.name).toContain('Copy')
  })

  it('tests event routing only in transient preview state and never persists a Track Map cue', async () => {
    await renderWorkspace()
    await act(async () => button('EVENTS').click())
    const before = JSON.stringify(useReactStore.getState().pixGridActionCuesByTrackId)
    await act(async () => button('Test Trigger').click())
    expect(JSON.stringify(useReactStore.getState().pixGridActionCuesByTrackId)).toBe(before)
  })

  it('reports unavailable analysis honestly before the renderer publishes a frame', async () => {
    await renderWorkspace()
    await act(async () => button('ANALYSIS').click())
    expect(container.textContent).toContain('Waiting for PixGrid frames')
    expect(container.textContent).toContain('No values are synthesized while analysis is absent')
  })
})

describe('PixGrid authored performance overrides', () => {
  it('disables a shipped route without compiling it and restores it when the override is removed', () => {
    const state = stateForBassBeacon()
    const routeId = BASS_BEACON_PERFORMANCE_PROGRAM.continuousRoutes[0].id
    const disabled = {
      ...state,
      performance: {
        ...state.performance,
        programOverrides: { routes: { [routeId]: { enabled: false } }, sections: {} },
      },
    }
    const compiler = new PixGridPerformanceProgramCompiler()
    const disabledCompiled = compiler.compile(BASS_BEACON_PERFORMANCE_PROGRAM, disabled)
    expect(disabledCompiled.program.continuousRoutes.some(route => route.id === routeId)).toBe(false)
    expect(disabledCompiled.assignments.some(assignment => assignment.id.includes(`:${routeId}:`))).toBe(false)

    const restored = compiler.compile(BASS_BEACON_PERFORMANCE_PROGRAM, state)
    expect(restored.program.continuousRoutes.some(route => route.id === routeId)).toBe(true)
    expect(restored.assignments.some(assignment => assignment.id.includes(`:${routeId}:`))).toBe(true)
  })

  it('compiles edited source, operation, shaping, confidence, fallback, and occurrence conditions', () => {
    const state = stateForBassBeacon()
    const route = BASS_BEACON_PERFORMANCE_PROGRAM.continuousRoutes[0]
    const edited: PixGridState = {
      ...state,
      performance: {
        ...state.performance,
        programOverrides: {
          routes: {
            [route.id]: {
              source: 'tension' as const,
              operation: 'contrast' as const,
              amount: 1.37,
              inputRange: [0.2, 0.8] as const,
              outputRange: [-0.4, 1.2] as const,
              curve: 'easeIn' as const,
              smoothing: 0.22,
              threshold: 0.31,
              hysteresis: 0.09,
              minimumConfidence: 0.71,
              capabilityFallback: 'energy' as const,
              blend: 'max' as const,
              sectionTypes: ['drop'],
              sectionOccurrences: [2],
              dropOccurrences: [2],
              priority: 77,
              targetScope: 'group' as const,
              targetId: state.groups[0]!.id,
            },
          },
          sections: {},
        },
      },
    }
    const compiled = new PixGridPerformanceProgramCompiler().compile(BASS_BEACON_PERFORMANCE_PROGRAM, edited)
    const assignment = compiled.assignments.find(candidate => candidate.id.includes(`:${route.id}:`))!
    expect(assignment).toMatchObject({
      source: 'tension', target: 'contrast', amount: expect.any(Number), inputRange: [0.2, 0.8],
      outputRange: [-0.4, 1.2], curve: 'easeIn', smoothing: 0.22, threshold: 0.31,
      hysteresis: 0.09, minimumConfidence: 0.71, capabilityFallback: 'energy', blend: 'max', priority: 77,
      targetScope: 'group', targetId: state.groups[0]!.id,
    })
    expect(assignment.conditions).toMatchObject({ includeSectionTypes: ['drop'], sectionOccurrences: [2], dropOccurrences: [2] })
  })

  it('compiles event-envelope and four/eight/sixteen-bar section overrides into the effective program', () => {
    const state = stateForBassBeacon()
    const eventRoute = BASS_BEACON_PERFORMANCE_PROGRAM.eventRoutes[0]
    const section = BASS_BEACON_PERFORMANCE_PROGRAM.sectionPlans.find(plan => plan.fourBarActions?.length && plan.eightBarRecruitment?.length && plan.sixteenBarEvolution?.length)!
    const edited: PixGridState = {
      ...state,
      performance: {
        ...state.performance,
        programOverrides: {
          routes: {
            [eventRoute.id]: {
              attack: 0.11, hold: 0.23, release: 0.47, decayCurve: 'overshoot' as const,
              quantization: 'bar' as const, retrigger: 'extend' as const,
            },
          },
          sections: {
            [section.id]: {
              density: 0.42, motion: 1.33, paletteIntensity: 0.76, negativeSpace: 0.61,
              fourBarEnabled: false, eightBarEnabled: false, sixteenBarEnabled: false,
              transitionIn: 'pixelDissolve' as const, transitionOut: 'paletteFade' as const,
            },
          },
        },
      },
    }
    const compiled = new PixGridPerformanceProgramCompiler().compile(BASS_BEACON_PERFORMANCE_PROGRAM, edited)
    const eventAssignment = compiled.assignments.find(candidate => candidate.id.includes(`:${eventRoute.id}:`))!
    expect(eventAssignment).toMatchObject({ attack: 0.11, hold: 0.23, release: 0.47, decayCurve: 'overshoot', quantization: 'bar', retrigger: 'extend' })
    const effectiveSection = compiled.program.sectionPlans.find(plan => plan.id === section.id)!
    expect(effectiveSection).toMatchObject({
      densityState: expect.objectContaining({ value: 0.42 }),
      motionState: expect.objectContaining({ amount: 1.33 }),
      paletteState: expect.objectContaining({ intensity: 0.76 }),
      negativeSpaceTarget: 0.61,
      fourBarActions: [], eightBarRecruitment: [], sixteenBarEvolution: [],
      transitionIn: expect.objectContaining({ type: 'pixelDissolve' }),
      transitionOut: expect.objectContaining({ type: 'paletteFade' }),
    })
  })
})
