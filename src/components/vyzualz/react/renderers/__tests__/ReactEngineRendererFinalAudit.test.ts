import { describe, expect, it, vi } from 'vitest'
import type { ReactEngineId, ReactPreset } from '../../ReactTypes'
import { DEFAULT_REACT_PRESETS } from '../../ReactTypes'
import { REACT_ENGINE_IDS } from '../../reactEngineCatalog'
import { DEFAULT_REACT_RENDER_PARAMS, disposeReactEngineRenderer, renderReactEngine } from '../ReactEngineRenderer'
import type { ReactFrameContext } from '../reactRenderUtils'

const rendererMocks = vi.hoisted(() => ({
  renderCinematicPortal: vi.fn(),
  disposeCinematicPortalRenderer: vi.fn(),
  renderSoundDrawing: vi.fn(),
  disposeSoundDrawingRenderer: vi.fn(),
  renderLaserDmx: vi.fn(),
  clearLaserDmxVisualState: vi.fn(),
  disposeLaserDmxRenderer: vi.fn(),
  pauseLaserDmxRenderer: vi.fn(),
}))

vi.mock('../CinematicPortalRenderer', () => ({
  renderCinematicPortal: rendererMocks.renderCinematicPortal,
  disposeCinematicPortalRenderer: rendererMocks.disposeCinematicPortalRenderer,
}))
vi.mock('../SoundDrawingRenderer', () => ({
  renderSoundDrawing: rendererMocks.renderSoundDrawing,
  disposeSoundDrawingRenderer: rendererMocks.disposeSoundDrawingRenderer,
}))
vi.mock('../LaserDmxRenderer', () => ({
  renderLaserDmx: rendererMocks.renderLaserDmx,
  clearLaserDmxVisualState: rendererMocks.clearLaserDmxVisualState,
  disposeLaserDmxRenderer: rendererMocks.disposeLaserDmxRenderer,
  pauseLaserDmxRenderer: rendererMocks.pauseLaserDmxRenderer,
}))

const frame: ReactFrameContext = {
  W: 640,
  H: 360,
  dpr: 1,
  t: 1,
  elapsedTimeSec: 0,
  deltaTimeSec: 1 / 60,
  timingDiscontinuity: false,
  timeSec: 0,
  audioTime: 0,
  bpm: 140,
  beatPhase: 0.25,
  beatHit: true,
  isPlaying: true,
  isPaused: false,
  audio: { bass: 0.4, mid: 0.3, high: 0.2, volume: 0.5 },
  freqData: null,
  timeDomainData: null,
  musicIntelligence: null,
}

function mockContext(): CanvasRenderingContext2D {
  return {
    canvas: { width: frame.W, height: frame.H } as HTMLCanvasElement,
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D
}

function samplePreset(engine: ReactEngineId): ReactPreset {
  const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.engine === engine)
  if (preset) return preset
  return {
    id: 'test-shader-runtime-preset',
    name: 'Shader Runtime Test',
    description: 'Synthetic renderer-dispatch preset for the standalone shader engine.',
    engine,
    palette: {
      primary: '#ffffff', secondary: '#ffffff', accent: '#ffffff',
      background: '#000000', highlight: '#ffffff', text: '#ffffff',
    },
    params: { intensity: 1, motion: 1, glow: 1, bassReactivity: 1 },
    scenes: [],
    sectionMappings: [],
  }
}

describe('React engine renderer final audit', () => {
  it('dispatches and disposes every currently registered engine family', () => {
    expect([...REACT_ENGINE_IDS].sort()).toEqual([
      'canvas',
      'cinematicPortal',
      'laserDmx',
      'oscilloscope',
      'shaderPads',
    ].sort())

    for (const engine of REACT_ENGINE_IDS) {
      const ctx = mockContext()
      expect(() => renderReactEngine(ctx, frame, samplePreset(engine), DEFAULT_REACT_RENDER_PARAMS)).not.toThrow()
      expect(() => disposeReactEngineRenderer(ctx, engine, { affectProductionOutput: true })).not.toThrow()
    }

    expect(rendererMocks.renderCinematicPortal).toHaveBeenCalledTimes(1)
    expect(rendererMocks.renderSoundDrawing).toHaveBeenCalledTimes(1)
    expect(rendererMocks.renderLaserDmx).toHaveBeenCalledTimes(1)
    expect(rendererMocks.disposeCinematicPortalRenderer).toHaveBeenCalledWith(expect.anything(), 'release-resources')
    expect(rendererMocks.disposeSoundDrawingRenderer).toHaveBeenCalledTimes(1)
    expect(rendererMocks.disposeLaserDmxRenderer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ affectProductionOutput: true }),
    )
  })
})
