/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSharedPerformanceContext } from '../../../../../features/performanceCore'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import { DEFAULT_CANVAS_PRESET_SETTINGS } from '../../ReactTypes'
import { CanvasFracturesRendererLayer } from '../CanvasFracturesRendererLayer'
import { CanvasFracturesRenderer } from './CanvasFracturesRenderer'
import type { CanvasFracturesRenderParams } from './CanvasFracturesTypes'

function makeContext() {
  return buildSharedPerformanceContext({
    audioTimeSec: 8,
    trackIdentity: 'track-integration',
    resolvedSections: [
      { id: 'build', label: 'Build', type: 'build', startSec: 0, endSec: 8, intensity: 0.7, confidence: 0.92, source: 'auto' },
      { id: 'drop', label: 'Drop', type: 'drop', startSec: 8, endSec: 16, intensity: 1, confidence: 0.96, source: 'auto' },
    ],
    frame: {
      ...DEFAULT_MI_FRAME,
      timeSec: 8,
      trackId: 'track-integration',
      sourceId: 'track-integration',
      bands: {
        ...DEFAULT_MI_FRAME.bands,
        normalizedBass: 0.9,
        normalizedMid: 0.5,
        normalizedHigh: 0.8,
      },
      rhythm: {
        ...DEFAULT_MI_FRAME.rhythm,
        bpm: 120,
        bpmConfidence: 0.95,
        beatIndex: 16,
        beatInBar: 0,
        beatHit: true,
        downbeatHit: true,
        kickHit: true,
        kickStrength: 1,
        snareHit: true,
        snareStrength: 0.9,
        hatHit: true,
        hatStrength: 0.7,
        transient: 1,
        transientConfidence: 0.95,
      },
      energy: {
        ...DEFAULT_MI_FRAME.energy,
        instant: 0.9,
        percentile: 0.94,
        spectralFlux: 0.8,
        tension: 0.75,
        buildProgress: 0.9,
        dropImpact: 1,
      },
      stems: {
        ...DEFAULT_MI_FRAME.stems,
        vocalEnergy: 0.8,
      },
      capabilities: {
        liveBands: true,
        rhythmEvents: true,
        beatGrid: true,
        sections: true,
        trackEnergyCurve: false,
        stemCurves: true,
        lyrics: false,
      },
      confidence: {
        ...DEFAULT_MI_FRAME.confidence,
        overall: 0.95,
        rhythm: 0.95,
        section: 0.95,
      },
    },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Canvas Fractures real audio routing integration', () => {
  it('consumes Canvas performance context without an Auto Performance gate and applies temporary modulation', () => {
    const render = vi.fn((_params: CanvasFracturesRenderParams) => true)
    const invalidateFeedback = vi.fn()
    vi.spyOn(CanvasFracturesRenderer, 'create').mockReturnValue({
      renderer: {
        backend: 'canvas2d',
        health: 'ready',
        planIdentity: null,
        setPlan: vi.fn(),
        resize: vi.fn(),
        render,
        invalidateFeedback,
        dispose: vi.fn(),
      } as unknown as CanvasFracturesRenderer,
      error: null,
    })
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)

    const image = document.createElement('img')
    Object.defineProperties(image, {
      complete: { value: true },
      naturalWidth: { value: 1280 },
      naturalHeight: { value: 720 },
    })
    const sourceRef = { current: image }
    const performanceContextRef = { current: makeContext() }
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const settings = {
      ...DEFAULT_CANVAS_PRESET_SETTINGS,
      fractureAudioResponse: 1,
      fractureBassMotion: 1,
      fractureTransientGlitch: 1,
      fractureStructuralResponse: 1,
      fractureRgbSplitAmount: 0.12,
      fractureSliceDisplacementAmount: 0.14,
    }

    act(() => {
      root.render(
        <CanvasFracturesRendererLayer
          active
          sourceRef={sourceRef}
          sourceIdentity="integration-image"
          mediaType="image"
          mediaRevision={1}
          trackIdentity="track-integration"
          getAudioTime={() => 8}
          analyser={null}
          performanceContextRef={performanceContextRef}
          isPlaying
          isPaused={false}
          fitMode="contain"
          sourceTransform={{ scale: 1, positionX: 0, positionY: 0, rotation: 0 }}
          settings={settings}
        />,
      )
    })

    expect(render).toHaveBeenCalled()
    const params = render.mock.calls[0][0]
    expect(params.audio?.bassMotion).toBeGreaterThan(0)
    expect(params.audio?.kickImpulse).toBeGreaterThan(0)
    expect(params.audio?.snareImpulse).toBeGreaterThan(0)
    expect(params.effects.rgbSplit).toBeGreaterThan(settings.fractureRgbSplitAmount)
    expect(params.effects.displacement).toBeGreaterThan(settings.fractureSliceDisplacementAmount)
    expect(params.sourceTransform.scale).toBeGreaterThan(1)

    act(() => root.unmount())
    host.remove()
  })
})
