import { describe, expect, it } from 'vitest'
import { AFTERHOURS_VIRTUAL_STAGE_RIG } from './AfterhoursVirtualStageRig'
import {
  AFTERHOURS_VISUAL_ACCEPTANCE_CHECKPOINT_IDS,
  AFTERHOURS_VISUAL_ACCEPTANCE_CHECKPOINTS,
  getAfterhoursVisualAcceptanceCheckpoint,
} from './AfterhoursVisualAcceptanceHarness'

const REQUIRED_IDS = [
  'static-wide-fan',
  'static-split-wings',
  'cross-canopy',
  'diamond-star',
  'sparse-architecture',
  'full-rig',
  'mid-motion-wide-sweep',
  'fan-open-close-fixed-phase',
  'full-blackout',
  'music-drop-impact',
  'music-quiet-sparse',
  'beam-8-side-top',
] as const

describe('Afterhours Stage 7 visual acceptance checkpoint catalog', () => {
  it('publishes the complete fixed checkpoint set in deterministic order', () => {
    expect(AFTERHOURS_VISUAL_ACCEPTANCE_CHECKPOINT_IDS).toEqual(REQUIRED_IDS)
    expect(AFTERHOURS_VISUAL_ACCEPTANCE_CHECKPOINTS.map(checkpoint => checkpoint.id)).toEqual(REQUIRED_IDS)
    expect(new Set(AFTERHOURS_VISUAL_ACCEPTANCE_CHECKPOINT_IDS).size).toBe(REQUIRED_IDS.length)
    for (const id of REQUIRED_IDS) expect(getAfterhoursVisualAcceptanceCheckpoint(id).id).toBe(id)
  })

  it('keeps the two falsification-critical checkpoints literal', () => {
    const blackout = getAfterhoursVisualAcceptanceCheckpoint('full-blackout')
    expect(blackout.settings.blackoutAmount).toBe(1)
    expect(blackout.music.impulses.dropStart).toBe(true)
    expect(blackout.music.sectionType).toBe('drop')

    const bankEight = getAfterhoursVisualAcceptanceCheckpoint('beam-8-side-top')
    expect(bankEight.settings.beamCount).toBe(8)
    expect(bankEight.settings.sideLasers).toBe(true)
    expect(bankEight.settings.topLasers).toBe(true)
    expect(bankEight.settings.motionAmount).toBe(0)
    expect(AFTERHOURS_VIRTUAL_STAGE_RIG.banks.leftWing.length).toBeGreaterThan(0)
    expect(AFTERHOURS_VIRTUAL_STAGE_RIG.banks.rightWing.length).toBeGreaterThan(0)
    expect(AFTERHOURS_VIRTUAL_STAGE_RIG.banks.overhead.length).toBeGreaterThan(0)
  })

  it('uses fixed transport/music values instead of wall-clock or random inputs', () => {
    const replayA = JSON.stringify(AFTERHOURS_VISUAL_ACCEPTANCE_CHECKPOINTS)
    const replayB = JSON.stringify(AFTERHOURS_VISUAL_ACCEPTANCE_CHECKPOINTS)
    expect(replayB).toBe(replayA)
    for (const checkpoint of AFTERHOURS_VISUAL_ACCEPTANCE_CHECKPOINTS) {
      expect(Number.isFinite(checkpoint.music.timeSec)).toBe(true)
      expect(Number.isFinite(checkpoint.music.bpm)).toBe(true)
      expect(checkpoint.settings.patternChange).toBe('off')
    }
  })
})
