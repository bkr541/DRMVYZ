/** @vitest-environment jsdom */

import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import { createCinemaMockWebGL, CinemaResizeObserverMock, type CinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import { Cinema2PresetsPanel } from '../../react/Cinema2PresetsPanel'
import { Cinema2Stage } from '../../react/Cinema2Stage'
import {
  CINEMA2_HUMN_CANONICAL_TOPOLOGY,
  CINEMA2_HUMN_COMPOSITION_ANCHOR,
  CINEMA2_HUMN_CRITICAL_FIGURE_BOUNDS,
  CINEMA2_HUMN_FRAGMENT_SOURCE,
  CINEMA2_HUMN_FUTURE_FACET_GROUPS,
  CINEMA2_HUMN_SKIN_FACET_GROUPS,
  CINEMA2_HUMN_LAYER_ID,
  CINEMA2_HUMN_MASTER_INTENSITY_ID,
  CINEMA2_HUMN_FIGURE_SCALE_ID,
  CINEMA2_HUMN_GRID_PRESENCE_ID,
  CINEMA2_HUMN_LINE_PRESENCE_ID,
  CINEMA2_HUMN_LINE_WEIGHT_ID,
  CINEMA2_HUMN_FRAGMENTATION_ID,
  CINEMA2_HUMN_MESH_DETAIL_ID,
  CINEMA2_HUMN_FACET_FILL_ID,
  CINEMA2_HUMN_FILL_STYLE_ID,
  CINEMA2_HUMN_NATIVE_MODULE_TYPE_ID,
  CINEMA2_HUMN_NATIVE_MODULE_VERSION,
  CINEMA2_HUMN_PRESET_ID,
  CINEMA2_HUMN_PRESET_MANIFEST,
  CINEMA2_HUMN_SEMANTIC_GROUPS,
  CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE,
  CINEMA2_RUNTIME_FOUNDATION_PRESET_ID,
  Cinema2AudioIntelligenceBridge,
  Cinema2Runtime,
  createCinema2DesignParentGroupModel,
  cinema2NativeModuleRegistry,
  cinema2NativePresetRegistry,
  resolveCinema2HumNFigureScale,
  type Cinema2PresetId,
} from '..'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import type { Cinema2Runtime as Cinema2RuntimeType } from '../runtime/Cinema2Runtime'

function createRafHarness() {
  const callbacks = new Map<number, FrameRequestCallback>()
  let nextId = 1
  return {
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      const id = nextId++
      callbacks.set(id, callback)
      return id
    }),
    cancelAnimationFrame: vi.fn((id: number) => callbacks.delete(id)),
    runNext(timestamp = 16.67) {
      const entry = [...callbacks.entries()][0]
      if (!entry) throw new Error('No Cinema 2.0 frame is scheduled.')
      callbacks.delete(entry[0])
      entry[1](timestamp)
    },
  }
}

class FakeCanvas extends EventTarget {
  width = 300
  height = 150
  readonly getContext: ReturnType<typeof vi.fn>

  constructor(gl: WebGL2RenderingContext) {
    super()
    this.getContext = vi.fn((kind: string) => kind === 'webgl2' ? gl : null)
  }
}

function createPresentAudioBridge() {
  let frameId = 0
  return new Cinema2AudioIntelligenceBridge({
    getFrame: () => ({
      ...DEFAULT_MI_FRAME,
      frameId: ++frameId,
      sourceId: 'hum-n-static-foundation-test',
      timeSec: frameId / 60,
      energy: { ...DEFAULT_MI_FRAME.energy, instant: frameId % 2 === 0 ? 0.88 : 0.12 },
      capabilities: { ...DEFAULT_MI_FRAME.capabilities!, liveBands: true },
      confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.95 },
    }),
    getPublicationMeta: () => ({
      sequence: frameId,
      publishedAtMs: frameId * 16.67,
      publisherId: 'hum-n-static-foundation-test',
      kind: 'frame' as const,
    }),
  })
}

function createHumNRuntime() {
  const raf = createRafHarness()
  const gl = createCinemaMockWebGL()
  gl.getUniformLocation = vi.fn((_program: WebGLProgram, name: string) =>
    ['u_resolution', 'u_masterIntensity', 'u_figureScale', 'u_gridPresence', 'u_linePresence', 'u_lineWeight', 'u_fragmentation', 'u_meshDetail', 'u_facetFill', 'u_fillStyle'].includes(name)
      ? ({ name } as unknown as WebGLUniformLocation)
      : null)
  const created = Cinema2Runtime.create(new FakeCanvas(gl) as unknown as HTMLCanvasElement, {
    presetId: CINEMA2_HUMN_PRESET_ID,
    presetRegistry: cinema2NativePresetRegistry,
    audioIntelligenceBridge: createPresentAudioBridge(),
    requestAnimationFrame: raf.requestAnimationFrame,
    cancelAnimationFrame: raf.cancelAnimationFrame,
  })
  expect(created.error).toBeNull()
  if (!created.runtime) throw new Error('Expected HUM:N native runtime')
  return { runtime: created.runtime, gl, raf }
}

let root: Root | null = null
let host: HTMLDivElement | null = null

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  CinemaResizeObserverMock.reset()
  vi.stubGlobal('ResizeObserver', CinemaResizeObserverMock)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
  host?.remove()
  host = null
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Cinema 2.0 HUM:N Phase A native visual foundation', () => {
  it('registers exactly once as a native first-party keeper and compiles to the synthesized scene-output path', () => {
    const declarations = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.filter(candidate => candidate.manifest.id === CINEMA2_HUMN_PRESET_ID)
    expect(declarations).toHaveLength(1)
    expect(declarations[0]).toMatchObject({ role: 'keeper' })
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest: CINEMA2_HUMN_PRESET_MANIFEST })).toMatchObject({ ok: true })

    const manifest = cinema2NativePresetRegistry.get(CINEMA2_HUMN_PRESET_ID)
    expect(manifest).not.toBeNull()
    expect(manifest?.metadata.name).toBe('HUM:N')
    expect(manifest?.metadata.tags).not.toContain('internal')
    expect(cinema2NativePresetRegistry.list().filter(candidate => candidate.id === CINEMA2_HUMN_PRESET_ID)).toHaveLength(1)
    expect(manifest?.modules).toHaveLength(1)
    expect(manifest?.modules?.[0]).toMatchObject({
      typeId: CINEMA2_HUMN_NATIVE_MODULE_TYPE_ID,
      version: CINEMA2_HUMN_NATIVE_MODULE_VERSION,
    })
    expect(cinema2NativeModuleRegistry.get(CINEMA2_HUMN_NATIVE_MODULE_TYPE_ID, CINEMA2_HUMN_NATIVE_MODULE_VERSION)).not.toBeNull()
    expect(manifest?.scene?.nodes.filter(node => node.kind === 'module')).toHaveLength(1)
    expect(manifest?.layers).toHaveLength(1)
    expect(manifest?.effects ?? []).toHaveLength(0)
    expect(manifest?.choreography ?? []).toHaveLength(0)
    expect(manifest?.cameras ?? []).toHaveLength(0)

    const compiled = cinema2NativePresetRegistry.compile(CINEMA2_HUMN_PRESET_ID, {
      availableCapabilities: ['render.webgl2'],
    })
    expect(compiled.ok, compiled.ok ? '' : compiled.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n')).toBe(true)
    if (!compiled.ok) return
    expect(compiled.plan.render).toMatchObject({
      synthesized: true,
      intent: 'scene-output',
      passOrder: ['auto-scene-output'],
      outputPassId: 'auto-scene-output',
      passes: [expect.objectContaining({
        id: 'auto-scene-output',
        kind: 'scene',
        layers: [expect.objectContaining({ id: CINEMA2_HUMN_LAYER_ID, index: 0 })],
      })],
    })
  })

  it('renders the same deliberately static native topology across frames even while authoritative audio is present', () => {
    expect(CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE).toBe(CINEMA2_HUMN_FRAGMENT_SOURCE)
    expect(CINEMA2_HUMN_CANONICAL_TOPOLOGY.primarySegments).toHaveLength(100)
    expect(CINEMA2_HUMN_CANONICAL_TOPOLOGY.accentSegments).toHaveLength(24)
    expect(CINEMA2_HUMN_CANONICAL_TOPOLOGY.ghostSegments).toHaveLength(18)
    expect(CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE).toContain('PRIMARY_SEGMENT_COUNT = 100')
    expect(CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE).toContain('ACCENT_SEGMENT_COUNT = 24')
    expect(CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE).toContain('GHOST_SEGMENT_COUNT = 18')
    expect(CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE).toContain('p.x *= aspect')
    expect(CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE).not.toContain('u_time')
    expect(CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE).not.toContain('u_audio')
    expect(CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE).toContain('macroGrid')

    const { runtime, gl, raf } = createHumNRuntime()
    runtime.resize({ width: 1280, height: 720, dpr: 1 })
    runtime.start()
    raf.runNext(16.67)
    raf.runNext(33.34)
    raf.runNext(50.01)

    expect(gl.__calls.drawCount).toBe(3)
    expect(runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 1, failedModuleCount: 0 })
    expect(runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: 3, executedPassCount: 3, failedPassCount: 0 })
    expect((gl.uniform1f as ReturnType<typeof vi.fn>).mock.calls).toEqual(expect.arrayContaining([
      [expect.objectContaining({ name: 'u_masterIntensity' }), 1],
      [expect.objectContaining({ name: 'u_figureScale' }), 1],
      [expect.objectContaining({ name: 'u_gridPresence' }), 1],
      [expect.objectContaining({ name: 'u_linePresence' }), 1],
      [expect.objectContaining({ name: 'u_lineWeight' }), 1],
      [expect.objectContaining({ name: 'u_fragmentation' }), 0.55],
      [expect.objectContaining({ name: 'u_facetFill' }), 0],
    ]))
    expect((gl.uniform1i as ReturnType<typeof vi.fn>).mock.calls).toEqual(expect.arrayContaining([
      [expect.objectContaining({ name: 'u_meshDetail' }), 1],
      [expect.objectContaining({ name: 'u_fillStyle' }), 3],
    ]))
    expect((gl.uniform2f as ReturnType<typeof vi.fn>).mock.calls).toEqual(expect.arrayContaining([
      [expect.objectContaining({ name: 'u_resolution' }), 1280, 720],
    ]))

    runtime.dispose()
    expect(gl.__calls.deletedPrograms).toBe(gl.__calls.createdPrograms)
    expect(gl.__calls.deletedBuffers).toBe(gl.__calls.createdBuffers)
    expect(gl.__calls.deletedVertexArrays).toBe(gl.__calls.createdVertexArrays)
  })

  it('exposes the six approved Figure Construction controls with the requested authority and defaults', () => {
    const { runtime } = createHumNRuntime()
    const plan = runtime.getCompiledPresetPlan()
    const state = runtime.getParameterState()
    const figureDefinitions = plan.parameters.definitions.filter(definition => definition.group === 'Figure Construction')
    expect(figureDefinitions.map(definition => definition.id)).toEqual([
      CINEMA2_HUMN_LINE_PRESENCE_ID,
      CINEMA2_HUMN_LINE_WEIGHT_ID,
      CINEMA2_HUMN_FRAGMENTATION_ID,
      CINEMA2_HUMN_MESH_DETAIL_ID,
      CINEMA2_HUMN_FACET_FILL_ID,
      CINEMA2_HUMN_FILL_STYLE_ID,
    ])
    expect(figureDefinitions.map(definition => definition.defaultValue)).toEqual([1, 1, 0.55, 'Reference', 0, 'Mixed'])
    expect(figureDefinitions.map(definition => [definition.modulatable, definition.choreographable])).toEqual([
      [true, true],
      [false, false],
      [true, true],
      [false, false],
      [true, true],
      [false, false],
    ])
    expect(state.getValue(CINEMA2_HUMN_LINE_PRESENCE_ID)).toBe(1)
    expect(state.getValue(CINEMA2_HUMN_LINE_WEIGHT_ID)).toBe(1)
    expect(state.getValue(CINEMA2_HUMN_FRAGMENTATION_ID)).toBe(0.55)
    expect(state.getValue(CINEMA2_HUMN_MESH_DETAIL_ID)).toBe('Reference')
    expect(state.getValue(CINEMA2_HUMN_FACET_FILL_ID)).toBe(0)
    expect(state.getValue(CINEMA2_HUMN_FILL_STYLE_ID)).toBe('Mixed')

    const design = createCinema2DesignParentGroupModel(plan, state.getSnapshot())
    const figureGroup = design.find(parent => parent.id === 'design')?.groups.find(group => group.label === 'Figure Construction')
    expect(figureGroup?.controls.map(control => control.definition.label)).toEqual([
      'Line Presence',
      'Line Weight',
      'Fragmentation',
      'Mesh Detail',
      'Facet Fill',
      'Fill Style',
    ])

    const moduleTargets = plan.targets.targets.filter(target => target.kind === 'module' && target.ownerId === CINEMA2_HUMN_PRESET_MANIFEST.modules?.[0]?.id)
    expect(moduleTargets.filter(target => ['linePresence', 'fragmentation', 'facetFill'].includes(target.property)).map(target => target.parameterId).sort()).toEqual([
      CINEMA2_HUMN_FACET_FILL_ID,
      CINEMA2_HUMN_FRAGMENTATION_ID,
      CINEMA2_HUMN_LINE_PRESENCE_ID,
    ].sort())
    runtime.dispose()
  })

  it('keeps the approved canonical topology semantically addressable with bound Figure Construction targets', () => {
    const expectedGroups = [
      'head-shell',
      'left-eye',
      'right-eye',
      'nose',
      'left-cheek',
      'right-cheek',
      'jaw-mouth',
      'left-ear',
      'right-ear',
      'neck',
      'shoulders',
      'primary-edges',
      'secondary-edges',
      'ghost-emergence-edges',
    ] as const

    for (const group of expectedGroups) {
      expect(CINEMA2_HUMN_SEMANTIC_GROUPS[group].length, group).toBeGreaterThan(0)
    }
    expect(CINEMA2_HUMN_FUTURE_FACET_GROUPS).toBe(CINEMA2_HUMN_SKIN_FACET_GROUPS)
    for (const [group, facets] of Object.entries(CINEMA2_HUMN_SKIN_FACET_GROUPS)) {
      expect(facets.length, group).toBeGreaterThan(0)
      const authoredSegments = [
        ...CINEMA2_HUMN_CANONICAL_TOPOLOGY.primarySegments,
        ...CINEMA2_HUMN_CANONICAL_TOPOLOGY.accentSegments,
        ...CINEMA2_HUMN_CANONICAL_TOPOLOGY.restorationSegments,
        ...CINEMA2_HUMN_CANONICAL_TOPOLOGY.denseSegments,
      ]
      for (const facet of facets) {
        for (let index = 0; index < facet.length; index += 2) {
          const point = [facet[index], facet[index + 1]]
          expect(authoredSegments.some(segment =>
            (segment[0] === point[0] && segment[1] === point[1]) || (segment[2] === point[0] && segment[3] === point[1])
          ), `${group} facet point ${point.join(',')}`).toBe(true)
        }
      }
    }

    const snapshot = JSON.stringify(CINEMA2_HUMN_CANONICAL_TOPOLOGY)
    expect(JSON.stringify(CINEMA2_HUMN_CANONICAL_TOPOLOGY)).toBe(snapshot)
    expect(CINEMA2_HUMN_PRESET_MANIFEST.parameters).toHaveLength(10)
    expect(CINEMA2_HUMN_PRESET_MANIFEST.modules?.[0]?.parameterBindings ?? {}).toEqual({
      masterIntensity: { $ref: CINEMA2_HUMN_MASTER_INTENSITY_ID },
      figureScale: { $ref: CINEMA2_HUMN_FIGURE_SCALE_ID },
      gridPresence: { $ref: CINEMA2_HUMN_GRID_PRESENCE_ID },
      linePresence: { $ref: CINEMA2_HUMN_LINE_PRESENCE_ID },
      lineWeight: { $ref: CINEMA2_HUMN_LINE_WEIGHT_ID },
      fragmentation: { $ref: CINEMA2_HUMN_FRAGMENTATION_ID },
      meshDetail: { $ref: CINEMA2_HUMN_MESH_DETAIL_ID },
      facetFill: { $ref: CINEMA2_HUMN_FACET_FILL_ID },
      fillStyle: { $ref: CINEMA2_HUMN_FILL_STYLE_ID },
    })
    expect(CINEMA2_HUMN_PRESET_MANIFEST.choreography ?? []).toHaveLength(0)
    expect(CINEMA2_HUMN_PRESET_MANIFEST.effects ?? []).toHaveLength(0)
  })

  it('projects Master Intensity flat under Master Controls and Figure Scale/Grid Presence into the approved Design groups', () => {
    const { runtime } = createHumNRuntime()
    const plan = runtime.getCompiledPresetPlan()
    const state = runtime.getParameterState()
    const definitions = new Map(plan.parameters.definitions.map(definition => [definition.id, definition]))

    expect(definitions.get(CINEMA2_HUMN_MASTER_INTENSITY_ID)).toMatchObject({
      label: 'Master Intensity',
      type: 'float',
      defaultValue: 1,
      min: 0,
      max: 1,
      step: 0.01,
      designParentGroup: 'master-controls',
      modulatable: false,
      choreographable: false,
      automatable: false,
    })
    expect(definitions.get(CINEMA2_HUMN_FIGURE_SCALE_ID)).toMatchObject({
      label: 'Figure Scale',
      type: 'float',
      defaultValue: 1,
      min: 0.7,
      max: 1.3,
      step: 0.01,
      group: 'Composition',
      designParentGroup: 'design',
      modulatable: false,
      choreographable: false,
      automatable: false,
    })
    expect(definitions.get(CINEMA2_HUMN_GRID_PRESENCE_ID)).toMatchObject({
      label: 'Grid Presence',
      type: 'float',
      defaultValue: 1,
      min: 0,
      max: 1,
      step: 0.01,
      group: 'Stage',
      designParentGroup: 'design',
      modulatable: false,
      choreographable: false,
      automatable: false,
    })

    expect(state.getValue(CINEMA2_HUMN_MASTER_INTENSITY_ID)).toBe(1)
    expect(state.getValue(CINEMA2_HUMN_FIGURE_SCALE_ID)).toBe(1)
    expect(state.getValue(CINEMA2_HUMN_GRID_PRESENCE_ID)).toBe(1)

    const design = createCinema2DesignParentGroupModel(plan, state.getSnapshot())
    const master = design.find(parent => parent.id === 'master-controls')
    expect(master?.groups).toEqual([])
    expect(master?.controls.map(control => control.definition.label)).toContain('Master Intensity')
    expect(design.find(parent => parent.id === 'design')?.groups.find(group => group.label === 'Composition')?.controls.map(control => control.definition.label)).toEqual(['Figure Scale'])
    expect(design.find(parent => parent.id === 'design')?.groups.find(group => group.label === 'Stage')?.controls.map(control => control.definition.label)).toEqual(['Grid Presence'])

    const moduleTargets = plan.targets.targets.filter(target => target.kind === 'module' && target.ownerId === CINEMA2_HUMN_PRESET_MANIFEST.modules?.[0]?.id)
    expect(moduleTargets.filter(target => ['masterIntensity', 'figureScale', 'gridPresence'].includes(target.property)).map(target => target.parameterId).sort()).toEqual([
      CINEMA2_HUMN_FIGURE_SCALE_ID,
      CINEMA2_HUMN_GRID_PRESENCE_ID,
      CINEMA2_HUMN_MASTER_INTENSITY_ID,
    ].sort())
    const userOwnedParameterIds = new Set<string>([
      CINEMA2_HUMN_MASTER_INTENSITY_ID,
      CINEMA2_HUMN_FIGURE_SCALE_ID,
      CINEMA2_HUMN_GRID_PRESENCE_ID,
    ])
    expect(plan.targets.choreographyTargets.filter(target =>
      target.target.parameterId != null && userOwnedParameterIds.has(target.target.parameterId)
    )).toHaveLength(0)
    runtime.dispose()
  })

  it('routes manual min/default/max and enum changes into real shader consumers without audio rewriting them', () => {
    const { runtime, gl, raf } = createHumNRuntime()
    runtime.resize({ width: 1280, height: 720, dpr: 1 })
    runtime.start()

    const state = runtime.getParameterState()
    expect(state.setPersistentValue(CINEMA2_HUMN_LINE_PRESENCE_ID, 0)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_HUMN_LINE_WEIGHT_ID, 2)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_HUMN_FRAGMENTATION_ID, 1)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_HUMN_MESH_DETAIL_ID, 'Dense')).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_HUMN_FACET_FILL_ID, 1)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_HUMN_FILL_STYLE_ID, 'Stripe')).toMatchObject({ ok: true })
    raf.runNext(16.67)

    expect((gl.uniform1f as ReturnType<typeof vi.fn>).mock.calls).toEqual(expect.arrayContaining([
      [expect.objectContaining({ name: 'u_linePresence' }), 0],
      [expect.objectContaining({ name: 'u_lineWeight' }), 2],
      [expect.objectContaining({ name: 'u_fragmentation' }), 1],
      [expect.objectContaining({ name: 'u_facetFill' }), 1],
    ]))
    expect((gl.uniform1i as ReturnType<typeof vi.fn>).mock.calls).toEqual(expect.arrayContaining([
      [expect.objectContaining({ name: 'u_meshDetail' }), 2],
      [expect.objectContaining({ name: 'u_fillStyle' }), 2],
    ]))

    expect(state.setPersistentValue(CINEMA2_HUMN_LINE_WEIGHT_ID, 0.5)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_HUMN_FRAGMENTATION_ID, 0)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_HUMN_MESH_DETAIL_ID, 'Sparse')).toMatchObject({ ok: true })
    raf.runNext(33.34)
    expect((gl.uniform1f as ReturnType<typeof vi.fn>).mock.calls).toEqual(expect.arrayContaining([
      [expect.objectContaining({ name: 'u_lineWeight' }), 0.5],
      [expect.objectContaining({ name: 'u_fragmentation' }), 0],
    ]))
    expect((gl.uniform1i as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([
      expect.objectContaining({ name: 'u_meshDetail' }), 0,
    ])

    const snapshot = state.getSnapshot()
    raf.runNext(50.01)
    expect(state.getSnapshot()).toEqual(snapshot)
    runtime.dispose()
  })

  it('routes Master Intensity, Figure Scale, and Grid Presence through independent native shader consumers', () => {
    const { runtime, gl, raf } = createHumNRuntime()
    runtime.resize({ width: 1280, height: 720, dpr: 1 })
    runtime.start()
    const state = runtime.getParameterState()

    raf.runNext(16.67)
    expect((gl.uniform1f as ReturnType<typeof vi.fn>).mock.calls).toEqual(expect.arrayContaining([
      [expect.objectContaining({ name: 'u_masterIntensity' }), 1],
      [expect.objectContaining({ name: 'u_figureScale' }), 1],
      [expect.objectContaining({ name: 'u_gridPresence' }), 1],
    ]))

    expect(state.setPersistentValue(CINEMA2_HUMN_MASTER_INTENSITY_ID, 0)).toMatchObject({ ok: true })
    raf.runNext(33.34)
    expect((gl.uniform1f as ReturnType<typeof vi.fn>).mock.calls).toEqual(expect.arrayContaining([
      [expect.objectContaining({ name: 'u_masterIntensity' }), 0],
      [expect.objectContaining({ name: 'u_gridPresence' }), 1],
    ]))
    expect(state.getValue(CINEMA2_HUMN_MASTER_INTENSITY_ID)).toBe(0)
    expect(state.getValue(CINEMA2_HUMN_GRID_PRESENCE_ID)).toBe(1)

    expect(state.setPersistentValue(CINEMA2_HUMN_FIGURE_SCALE_ID, 0.7)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_HUMN_GRID_PRESENCE_ID, 0)).toMatchObject({ ok: true })
    raf.runNext(50.01)
    expect((gl.uniform1f as ReturnType<typeof vi.fn>).mock.calls).toEqual(expect.arrayContaining([
      [expect.objectContaining({ name: 'u_masterIntensity' }), 0],
      [expect.objectContaining({ name: 'u_figureScale' }), 0.7],
      [expect.objectContaining({ name: 'u_gridPresence' }), 0],
    ]))
    expect(state.getValue(CINEMA2_HUMN_GRID_PRESENCE_ID)).toBe(0)

    expect(state.setPersistentValue(CINEMA2_HUMN_MASTER_INTENSITY_ID, 1)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_HUMN_FIGURE_SCALE_ID, 1.3)).toMatchObject({ ok: true })
    expect(state.setPersistentValue(CINEMA2_HUMN_GRID_PRESENCE_ID, 1)).toMatchObject({ ok: true })
    raf.runNext(66.68)
    const safeMaxScale = resolveCinema2HumNFigureScale(1.3, 1280, 720)
    expect(safeMaxScale).toBeGreaterThan(1)
    expect(safeMaxScale).toBeLessThanOrEqual(1.3)
    expect((gl.uniform1f as ReturnType<typeof vi.fn>).mock.calls).toEqual(expect.arrayContaining([
      [expect.objectContaining({ name: 'u_masterIntensity' }), 1],
      [expect.objectContaining({ name: 'u_figureScale' }), safeMaxScale],
      [expect.objectContaining({ name: 'u_gridPresence' }), 1],
    ]))

    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).toContain('vec3 stageColor = background + gridColor;')
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).toContain('if (masterIntensity < 0.999999) color = mix(stageColor, figureColor, masterIntensity);')
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).toContain('if (gridPresence < 0.999999) gridColor *= gridPresence;')
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).toContain('if (abs(figureScale - 1.0) > 0.000001)')
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).toContain('compositionAnchor + (p - compositionAnchor) / figureScale')

    const snapshot = state.getSnapshot()
    raf.runNext(83.35)
    expect(state.getSnapshot()).toEqual(snapshot)
    runtime.dispose()
  })

  it('keeps Facet Fill zero as the exact authored default and routes mid/full fill plus every Fill Style to deterministic shader consumers', () => {
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).toContain('SKIN_FACET_COUNT = 45')
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).toContain('if (facetFill > 0.0)')
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).toContain('skinCoverage * facetFill * 0.90')
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).not.toContain('u_audio')
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).not.toContain('u_time')

    const { runtime, gl, raf } = createHumNRuntime()
    runtime.resize({ width: 1280, height: 720, dpr: 1 })
    runtime.start()
    const state = runtime.getParameterState()

    raf.runNext(16.67)
    expect((gl.uniform1f as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([
      expect.objectContaining({ name: 'u_facetFill' }), 0,
    ])

    expect(state.setPersistentValue(CINEMA2_HUMN_FACET_FILL_ID, 0.5)).toMatchObject({ ok: true })
    raf.runNext(33.34)
    expect((gl.uniform1f as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([
      expect.objectContaining({ name: 'u_facetFill' }), 0.5,
    ])

    const styles = [['Solid', 0], ['Gradient', 1], ['Stripe', 2], ['Mixed', 3]] as const
    for (const [style, shaderIndex] of styles) {
      expect(state.setPersistentValue(CINEMA2_HUMN_FILL_STYLE_ID, style)).toMatchObject({ ok: true })
      expect(state.setPersistentValue(CINEMA2_HUMN_FACET_FILL_ID, 1)).toMatchObject({ ok: true })
      raf.runNext(50.01 + shaderIndex * 16.67)
      expect((gl.uniform1i as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([
        expect.objectContaining({ name: 'u_fillStyle' }), shaderIndex,
      ])
    }

    const snapshot = JSON.stringify(CINEMA2_HUMN_SKIN_FACET_GROUPS)
    expect(JSON.stringify(CINEMA2_HUMN_SKIN_FACET_GROUPS)).toBe(snapshot)
    runtime.dispose()
  })

  it('keeps Figure Scale centered and inside the critical safe bounds across landscape, square, portrait, and ultrawide viewports', () => {
    const { runtime, gl, raf } = createHumNRuntime()
    runtime.start()
    const sizes = [[1600, 900], [1024, 1024], [900, 1200], [1920, 800]] as const
    const requestedScales = [0.7, 1, 1.3] as const
    const state = runtime.getParameterState()

    let frame = 0
    for (const [width, height] of sizes) {
      for (const requested of requestedScales) {
        runtime.resize({ width, height, dpr: 1 })
        expect(state.setPersistentValue(CINEMA2_HUMN_FIGURE_SCALE_ID, requested)).toMatchObject({ ok: true })
        raf.runNext(16.67 * ++frame)

        const effective = resolveCinema2HumNFigureScale(requested, width, height)
        expect((gl.uniform1f as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([
          expect.objectContaining({ name: 'u_figureScale' }), effective,
        ])

        const aspect = width / height
        const t = Math.min(1, Math.max(0, (aspect - 1.10) / (1.90 - 1.10)))
        const portraitScale = 1.02 + (1.14 - 1.02) * (t * t * (3 - 2 * t))
        const screenXs = [CINEMA2_HUMN_CRITICAL_FIGURE_BOUNDS.minX, CINEMA2_HUMN_CRITICAL_FIGURE_BOUNDS.maxX].map(x =>
          portraitScale * (CINEMA2_HUMN_COMPOSITION_ANCHOR.x + effective * (x - CINEMA2_HUMN_COMPOSITION_ANCHOR.x)) / aspect
        )
        const screenYs = [CINEMA2_HUMN_CRITICAL_FIGURE_BOUNDS.minY, CINEMA2_HUMN_CRITICAL_FIGURE_BOUNDS.maxY].map(y =>
          portraitScale * (CINEMA2_HUMN_COMPOSITION_ANCHOR.y + effective * (y - CINEMA2_HUMN_COMPOSITION_ANCHOR.y) - 0.012)
        )
        expect(Math.max(...screenXs.map(Math.abs))).toBeLessThanOrEqual(0.995001)
        expect(Math.max(...screenYs.map(Math.abs))).toBeLessThanOrEqual(0.995001)
      }
    }

    expect(runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: sizes.length * requestedScales.length, failedPassCount: 0 })
    const resolutionCalls = (gl.uniform2f as ReturnType<typeof vi.fn>).mock.calls.map((call: unknown[]) => [call[1], call[2]])
    for (const size of sizes) expect(resolutionCalls).toContainEqual([...size])
    runtime.dispose()
  })

  it('appears once in the real Cinema 2.0 preset browser and reconstructs through the production Stage path after switching away and back', async () => {
    const raf = createRafHarness()
    vi.stubGlobal('requestAnimationFrame', raf.requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', raf.cancelAnimationFrame)
    const contexts: CinemaMockWebGL[] = []
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => {
      if (kind !== 'webgl2') return null
      const gl = createCinemaMockWebGL()
      contexts.push(gl)
      return gl as unknown as RenderingContext
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 1280,
      height: 720,
      top: 0,
      left: 0,
      right: 1280,
      bottom: 720,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    const activeRuntimeRef: { current: Cinema2RuntimeType | null } = { current: null }
    function Harness() {
      const [presetId, setPresetId] = useState<Cinema2PresetId>(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID)
      return <>
        <button data-testid="foundation" onClick={() => setPresetId(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID)}>Foundation</button>
        <Cinema2PresetsPanel activePresetId={presetId} onSelectPreset={setPresetId} />
        <Cinema2Stage presetId={presetId} onRuntimeReady={runtime => { activeRuntimeRef.current = runtime }} />
      </>
    }

    await act(async () => root?.render(<Harness />))
    const humButtons = host?.querySelectorAll<HTMLButtonElement>(`[data-cinema2-preset-id="${CINEMA2_HUMN_PRESET_ID}"]`) ?? []
    expect(humButtons).toHaveLength(1)
    expect(humButtons[0]?.textContent).toContain('HUM:N')

    await act(async () => humButtons[0]?.click())
    expect(activeRuntimeRef.current?.getCompiledPresetPlan().presetId).toBe(CINEMA2_HUMN_PRESET_ID)
    await act(async () => raf.runNext())
    expect(activeRuntimeRef.current?.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: 1, executedPassCount: 1, failedPassCount: 0 })
    expect(contexts[contexts.length - 1]?.__calls.drawCount).toBeGreaterThan(0)

    await act(async () => host?.querySelector<HTMLButtonElement>('[data-testid="foundation"]')?.click())
    expect(activeRuntimeRef.current?.getCompiledPresetPlan().presetId).toBe(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID)
    const humButtonAfterSwitch = host?.querySelector<HTMLButtonElement>(`[data-cinema2-preset-id="${CINEMA2_HUMN_PRESET_ID}"]`)
    await act(async () => humButtonAfterSwitch?.click())
    expect(activeRuntimeRef.current?.getCompiledPresetPlan().presetId).toBe(CINEMA2_HUMN_PRESET_ID)
    await act(async () => raf.runNext(33.34))
    expect(activeRuntimeRef.current?.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: 1, failedPassCount: 0 })
    expect(contexts.length).toBeGreaterThanOrEqual(3)
  })
})
