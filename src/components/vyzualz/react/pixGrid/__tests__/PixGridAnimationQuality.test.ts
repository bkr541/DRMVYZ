import { describe, expect, it } from 'vitest'
import { compilePixGridDeckRasterFrame } from '../PixGridDeckCompilerCore'
import { composePixGridDeckRuntimeFrame } from '../PixGridDeckCompositor'
import { compilePixGridDeckPreparedFrameTransition, createPixGridDeckTransitionCacheKey } from '../PixGridDeckTransitionPlanner'
import { getPixGridMotionProfile, resolvePixGridMotionDynamics } from '../PixGridMotionProfiles'
import type { PixGridAudioFrame } from '../PixGridTypes'

const WIDTH = 20
const HEIGHT = 14

function frame(id: string, variant: number) {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4)
  const alpha = new Uint8Array(WIDTH * HEIGHT)
  for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) {
    const lit = variant === 0
      ? (x < 8 && y > 2 && y < 12)
      : (x > 11 && (x + y) % 3 !== 0 && y > 1 && y < 13)
    const cell = y * WIDTH + x
    pixels.set([variant ? 255 : 30, variant ? 70 : 220, variant ? 160 : 255, lit ? 255 : 0], cell * 4)
    alpha[cell] = lit ? 255 : 0
  }
  return compilePixGridDeckRasterFrame({ cacheKey: `quality:${id}`, mediaId: id, sourceFingerprint: `legacy:${id}`, sourceRevision: 1, rasterPixels: pixels, sourceAlpha: alpha, width: WIDTH, height: HEIGHT, transparentBackground: '#000000', hasAlpha: true })
}

function hash(pixels: Uint8Array): number {
  let value = 0x811c9dc5
  for (const byte of pixels) { value ^= byte; value = Math.imul(value, 0x01000193) }
  return value >>> 0
}

function occupancy(pixels: Uint8Array): number {
  let count = 0
  for (let offset = 3; offset < pixels.length; offset += 4) if (pixels[offset]! > 0) count += 1
  return count
}

function meanBrightness(pixels: Uint8Array): number {
  let total = 0
  for (let offset = 0; offset < pixels.length; offset += 4) total += (pixels[offset]! + pixels[offset + 1]! + pixels[offset + 2]!) * pixels[offset + 3]! / (255 * 3)
  return total / (pixels.length / 4)
}

const silentAudio: PixGridAudioFrame = { audioTime: 0, bass: 0, mid: 0, high: 0, volume: 0, beatHit: false, beatPhase: 0, isPlaying: true, sourceValues: {} }

function transition(profileId: string) {
  const source = frame('a', 0)
  const target = frame('b', 1)
  const profile = getPixGridMotionProfile(profileId)
  const settings = { requestedMode: 'pixelTransport' as const, sourceItemId: 'a', targetItemId: 'b', durationFraction: 0.5, preferredStrategy: profile.preferredStrategy }
  const plan = compilePixGridDeckPreparedFrameTransition({
    cacheKey: createPixGridDeckTransitionCacheKey({ sourceFrameCacheKey: source.cacheKey, targetFrameCacheKey: target.cacheKey, settings }),
    source, target, settings,
  })
  const at = (progress: number) => new Uint8Array(composePixGridDeckRuntimeFrame({
    kind: 'deck', deckId: 'quality', deckRevision: 1, width: WIDTH, height: HEIGHT,
    sourceItemId: 'a', targetItemId: 'b', sourceFrame: source, targetFrame: target,
    transitionPlan: plan, transitionMode: plan.mode, transitionProgress: progress, transitionActive: progress < 1,
    boundaryIdentity: 'quality', frameEpoch: 1, identity: `quality:${progress}`, fallbackReason: null,
    motionProfileId: profile.id,
    transitionDynamics: resolvePixGridMotionDynamics({ profile, audioFrame: silentAudio, choreography: { motionScale: 1, energy: 0.5, impact: 0 }, transitionActive: true }),
  }).pixels)
  return { source, target, plan, at }
}

describe('PixGrid animation-quality regression', () => {
  it('keeps spatial intermediates non-empty, continuous, bounded, arrival-exact, and deterministic', () => {
    const fixture = transition('flow')
    const progress = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]
    const frames = progress.map(fixture.at)
    expect(frames[0]).toEqual(fixture.source.pixels)
    expect(frames[frames.length - 1]).toEqual(fixture.target.pixels)
    expect(frames.map(hash)).toEqual(progress.map(value => hash(fixture.at(value))))
    expect(new Set(frames.map(hash)).size).toBeGreaterThanOrEqual(5)
    for (const intermediate of frames.slice(1, -1)) {
      expect(occupancy(intermediate)).toBeGreaterThan(0)
      expect(occupancy(intermediate)).toBeLessThanOrEqual(WIDTH * HEIGHT)
      expect(meanBrightness(intermediate)).toBeLessThanOrEqual(Math.max(meanBrightness(fixture.source.pixels), meanBrightness(fixture.target.pixels)) * 1.75)
    }
  })

  it('keeps compiled motion families behaviorally distinct instead of degrading to one fade', () => {
    const flow = transition('flow')
    const explosive = transition('explosive-reconstruction')
    const clustered = transition('clustered-morph')
    expect([flow.plan.strategy, explosive.plan.strategy, clustered.plan.strategy]).toEqual(['directionalFlow', 'disperseReconstruct', 'clusteredMorph'])
    expect(new Set([hash(flow.at(0.5)), hash(explosive.at(0.5)), hash(clustered.at(0.5))]).size).toBe(3)
    expect([flow.plan.mode, explosive.plan.mode, clustered.plan.mode]).toEqual(['pixelTransport', 'pixelTransport', 'pixelTransport'])
  })
})
