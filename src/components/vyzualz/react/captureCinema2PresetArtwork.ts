import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import { Cinema2AudioIntelligenceBridge, Cinema2Runtime, cinema2NativePresetRegistry, type Cinema2PresetId } from '../cinema2'

/** Actual native scene capture. No live audio, media pool, transport or user files. */
export async function captureCinema2PresetArtwork(id: string): Promise<string> {
  const presetId = id as Cinema2PresetId
  if (!cinema2NativePresetRegistry.has(presetId)) throw new Error(`Unknown Cinema 2.0 preset: ${id}`)
  const width = 480, height = 270
  const scene = document.createElement('canvas')
  const output = document.createElement('canvas')
  scene.width = output.width = width
  scene.height = output.height = height
  const ctx = output.getContext('2d')
  const probe = document.createElement('canvas')
  probe.width = 48; probe.height = 27
  const sampleContext = probe.getContext('2d', { willReadFrequently: true })
  if (!ctx || !sampleContext) throw new Error('Canvas capture unavailable')

  let index = 0
  const base = structuredClone(DEFAULT_MI_FRAME)
  const fixture = 'preset-artwork-fixture'
  const bridge = new Cinema2AudioIntelligenceBridge({
    getFrame: (): MusicIntelligenceFrame => {
      const beat = Math.floor(index / 15)
      const hit = index % 15 === 0
      return {
        ...base, sourceId: fixture, trackId: fixture, frameId: index, timeSec: 30 + index / 30,
        capabilities: { ...base.capabilities!, liveBands: true, rhythmEvents: true, beatGrid: true, sections: true },
        bands: { sub: .65, bass: .65, lowMid: .55, mid: .55, high: .55, air: .55, volume: .65,
          normalizedSub: .65, normalizedBass: .65, normalizedLowMid: .55, normalizedMid: .55, normalizedHigh: .55, normalizedAir: .55 },
        energy: { ...base.energy, instant: .65, shortTerm: .65, rms: .6, peak: .8, percentile: .7 },
        section: { ...base.section, type: 'drop', label: 'Drop', startSec: 30, endSec: 62, confidence: 1, intensity: .8 },
        rhythm: { ...base.rhythm, bpm: 120, bpmConfidence: 1, bpmSource: 'manual_override', beatIndex: beat,
          beatInBar: beat % 4, barIndex: Math.floor(beat / 4), beatPhase: index % 15 / 15,
          beatHit: hit, downbeatHit: hit && beat % 4 === 0, beatEventId: hit ? beat : null,
          beatEventTimeSec: hit ? 30 + index / 30 : null, kickHit: hit, kickStrength: .8, transient: .7 },
      }
    },
    getPublicationMeta: () => ({ sequence: index, publishedAtMs: index * 1000 / 30, publisherId: fixture, kind: 'frame' }),
  })
  let callback: FrameRequestCallback | null = null
  const result = Cinema2Runtime.create(scene, {
    presetId, renderQuality: 'low', audioIntelligenceBridge: bridge,
    randomness: { mode: 'deterministic', seed: 42 },
    requestAnimationFrame: next => { callback = next; return 1 },
    cancelAnimationFrame: () => { callback = null },
  })
  if (!result.runtime) throw new Error(result.error)
  const runtime = result.runtime
  try {
    runtime.resize({ width, height, dpr: 1 })
    runtime.start()
    let bestScore = -1
    for (let frame = 0; frame < 100; frame++) {
      index = frame + 1
      // Yield between frames for asset imports and normal UI work. Read the
      // WebGL canvas immediately after rendering, before its buffer clears.
      await new Promise<void>(resolve => setTimeout(resolve, 25))
      const next = callback as FrameRequestCallback | null
      callback = null
      if (!next) continue
      next(frame * 1000 / 30)
      sampleContext.drawImage(scene, 0, 0, 48, 27)
      const pixels = sampleContext.getImageData(0, 0, 48, 27).data
      let lit = 0, score = 0, min = 255, max = 0
      for (let i = 0; i < pixels.length; i += 4) {
        const value = Math.max(pixels[i], pixels[i + 1], pixels[i + 2])
        if (value > 40) lit++
        score += value
        min = Math.min(min, value); max = Math.max(max, value)
      }
      // Reject blank and flat-color startup frames; retain the most legible scene.
      if (frame > 8 && lit >= 6 && max - min > 20 && score > bestScore) {
        bestScore = score
        ctx.drawImage(scene, 0, 0, width, height)
      }
    }
    const snapshot = runtime.getSnapshot()
    if (snapshot.phase === 'unavailable' || snapshot.phase === 'context-lost') throw new Error(snapshot.statusMessage ?? 'Cinema capture failed')
    if (bestScore < 0) throw new Error(`No visible rendered frame for ${id}`)
    return output.toDataURL('image/webp', .86)
  } finally {
    runtime.dispose()
    scene.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
