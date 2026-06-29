import { describe, expect, it } from 'vitest'
import { createDefaultCinematicWorldConfig } from '../../CinematicWorldConfig'
import { DEFAULT_REACT_PRESETS } from '../../ReactTypes'
import {
  CinematicWorldRendererHost,
  CinematicWorldRendererRegistry,
} from '../CinematicWorldRenderer'
import type {
  CinematicRendererInitializeInput,
  CinematicRendererResetReason,
  CinematicViewport,
  CinematicWorldRenderer,
  CinematicWorldRenderInput,
} from '../CinematicWorldRenderer'
import { DEFAULT_REACT_RENDER_PARAMS } from '../reactRenderUtils'
import { legacyPortalFrameScale, legacyPortalPerFrameDecay } from '../CinematicPortalRenderer'

interface Recorder {
  initialized: CinematicRendererInitializeInput[]
  resized: CinematicViewport[]
  rendered: CinematicWorldRenderInput[]
  reset: CinematicRendererResetReason[]
  disposed: number
}

function createRecorder(): Recorder {
  return { initialized: [], resized: [], rendered: [], reset: [], disposed: 0 }
}

class RecordingRenderer implements CinematicWorldRenderer {
  constructor(private readonly recorder: Recorder) {}
  initialize(input: CinematicRendererInitializeInput): void { this.recorder.initialized.push(input) }
  resize(viewport: CinematicViewport): void { this.recorder.resized.push(viewport) }
  render(input: CinematicWorldRenderInput): void { this.recorder.rendered.push(input) }
  reset(reason: CinematicRendererResetReason): void { this.recorder.reset.push(reason) }
  dispose(): void { this.recorder.disposed++ }
}

function makeInput(presetId = 'preset-dream-gate'): CinematicWorldRenderInput {
  const preset = {
    ...DEFAULT_REACT_PRESETS.find(item => item.id === 'preset-dream-gate')!,
    id: presetId,
  }
  return {
    elapsedTimeSec: 2,
    deltaTimeSec: 1 / 60,
    transportTimeSec: 12,
    viewport: { width: 1280, height: 720, dpr: 1 },
    audio: {
      bass: 0.4,
      mid: 0.3,
      high: 0.2,
      volume: 0.4,
      beatHit: false,
      beatPhase: 0.5,
      bpm: 120,
    },
    trackAnalysis: null,
    config: createDefaultCinematicWorldConfig(),
    preset,
    presetId,
    params: DEFAULT_REACT_RENDER_PARAMS,
    sectionType: 'verse',
  }
}


describe('legacy portal timing', () => {
  it.each([30, 60, 120])('preserves one second of movement at %i Hz', (fps) => {
    const delta = 1 / fps
    const movement = Array.from({ length: fps }, () => legacyPortalFrameScale(delta))
      .reduce((sum, frameScale) => sum + frameScale, 0)
    const decay = Array.from({ length: fps }, () => legacyPortalPerFrameDecay(0.965, delta))
      .reduce((value, multiplier) => value * multiplier, 1)

    expect(movement).toBeCloseTo(60, 10)
    expect(decay).toBeCloseTo(Math.pow(0.965, 60), 10)
  })
})

describe('CinematicWorldRendererHost', () => {
  it('recreates isolated renderer state when preset identity changes', () => {
    const recorders: Recorder[] = []
    const registry = new CinematicWorldRendererRegistry()
    registry.register('legacyPortal', () => {
      const recorder = createRecorder()
      recorders.push(recorder)
      return new RecordingRenderer(recorder)
    })
    const context = {} as CanvasRenderingContext2D
    const host = new CinematicWorldRendererHost(context, registry)

    host.render(makeInput())
    host.render({ ...makeInput(), elapsedTimeSec: 3 })
    expect(recorders).toHaveLength(1)
    expect(recorders[0].rendered).toHaveLength(2)
    expect(recorders[0].resized).toHaveLength(1)

    host.render(makeInput('preset-crimson-rift'))

    expect(recorders).toHaveLength(2)
    expect(recorders[0].reset).toEqual(['presetChanged'])
    expect(recorders[0].disposed).toBe(1)
    expect(recorders[1].initialized[0].presetId).toBe('preset-crimson-rift')
  })

  it('recreates state when the deterministic seed changes', () => {
    const recorders: Recorder[] = []
    const registry = new CinematicWorldRendererRegistry()
    registry.register('legacyPortal', () => {
      const recorder = createRecorder()
      recorders.push(recorder)
      return new RecordingRenderer(recorder)
    })
    const host = new CinematicWorldRendererHost({} as CanvasRenderingContext2D, registry)
    const input = makeInput()

    host.render(input)
    host.render({ ...input, config: { ...input.config, seed: input.config.seed + 1 } })

    expect(recorders).toHaveLength(2)
    expect(recorders[0].reset).toEqual(['structuralConfigurationChanged'])
    expect(recorders[0].disposed).toBe(1)
  })

  it('uses the legacy renderer as a compatibility fallback for unregistered future worlds', () => {
    const recorder = createRecorder()
    const registry = new CinematicWorldRendererRegistry()
    registry.register('legacyPortal', () => new RecordingRenderer(recorder))
    const host = new CinematicWorldRendererHost({} as CanvasRenderingContext2D, registry)
    const input = makeInput()
    input.config = { ...input.config, worldMode: 'eventHorizon' }

    host.render(input)

    expect(recorder.initialized).toHaveLength(1)
    expect(recorder.initialized[0].config.worldMode).toBe('eventHorizon')
    expect(recorder.rendered[0].config.worldMode).toBe('eventHorizon')
  })
})
