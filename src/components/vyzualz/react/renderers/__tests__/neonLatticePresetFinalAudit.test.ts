import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NEON_LATTICE_SETTINGS,
  DEFAULT_PERFORMANCE_PADS,
  DEFAULT_REACT_PRESETS,
  type NeonLatticePhraseScale,
} from '../../ReactTypes'
import { normalizeNeonLatticeSettings } from '../../NeonLatticeConfig'
import {
  STABLE_NEON_LATTICE_PRESET_IDS,
  neonLatticePhraseActionSignature,
  validateNeonLatticePresetLibrary,
} from '../neonLatticePresetValidation'

function neonSettings(presetId: string) {
  const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === presetId)
  expect(preset?.engine).toBe('neonLattice')
  return normalizeNeonLatticeSettings({
    ...DEFAULT_NEON_LATTICE_SETTINGS,
    ...preset?.neonLatticeSettings,
  })
}

describe('final Neon Lattice preset library audit', () => {
  it('keeps the four public IDs and every existing performance-pad reference valid', () => {
    const presetIds = new Set(DEFAULT_REACT_PRESETS.map(preset => preset.id))
    expect(STABLE_NEON_LATTICE_PRESET_IDS.every(id => presetIds.has(id))).toBe(true)
    expect(DEFAULT_PERFORMANCE_PADS
      .filter(pad => pad.presetId != null)
      .every(pad => presetIds.has(pad.presetId!))).toBe(true)
  })

  it('validates unique IDs, normalized settings, authored patterns, palette roles, and distinct choreography', () => {
    const validation = validateNeonLatticePresetLibrary(DEFAULT_REACT_PRESETS)
    expect(validation.issues).toEqual([])
    expect(validation.valid).toBe(true)
    expect(new Set(Object.values(validation.choreographySignatures)).size)
      .toBe(Object.keys(validation.choreographySignatures).length)
  })

  it.each(STABLE_NEON_LATTICE_PRESET_IDS)('%s has intentional and different 4/8/16/32-beat actions', presetId => {
    const settings = neonSettings(presetId)
    const scales: NeonLatticePhraseScale[] = [4, 8, 16, 32]
    const signatures = scales.map(scale => neonLatticePhraseActionSignature(settings, scale))
    expect(signatures.every(Boolean)).toBe(true)
    expect(new Set(signatures).size).toBe(scales.length)
  })

  it('ships Reverie Keygrid as a deterministic, recording-inspired, no-MIDI lane sequencer', () => {
    const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === 'preset-nl-reverie-keygrid')
    const settings = neonSettings('preset-nl-reverie-keygrid')
    expect(preset?.palette.background).toBe('#010207')
    expect(preset?.palette.highlight).toBe('#ffffff')
    expect(settings).toMatchObject({
      compositionMode: 'laneSequencer',
      verticalSpanMode: 'fullCanvas',
      retriggerBehavior: 'restart',
      blockDensity: 0,
      shockwaveAmount: 0,
      cameraMotion: 0,
    })
    expect(settings.lanePattern.orientations).toEqual(['vertical'])
    expect(settings.lanePattern.steps.some(step => step.lanes.length >= 3)).toBe(true)
    expect(JSON.stringify(preset?.neonLatticeSettings)).not.toMatch(/midi/i)
  })

  it('normalizes malformed settings safely and idempotently without persisting runtime state', () => {
    const malformed = normalizeNeonLatticeSettings({
      ...DEFAULT_NEON_LATTICE_SETTINGS,
      orientationWeights: { vertical: Number.NaN, horizontal: -4, diagonalUp: 2, diagonalDown: 3 },
      lanePattern: {
        ...DEFAULT_NEON_LATTICE_SETTINGS.lanePattern,
        laneCount: 4,
        sequenceLength: 2,
        steps: [{ lanes: [-100, 99], paletteRole: 'not-a-role' as never }],
      },
      customSegments: [{ id: 'bad', startX: 0.5, startY: 0.5, endX: 0.5, endY: 0.5 }],
    })
    expect(malformed.customSegments).toEqual([])
    expect(malformed.lanePattern.steps).toHaveLength(2)
    expect(malformed.lanePattern.steps.flatMap(step => step.lanes).every(lane => lane >= 0 && lane < 4)).toBe(true)
    expect(normalizeNeonLatticeSettings(malformed)).toEqual(malformed)
    expect(malformed).not.toHaveProperty('runtime')
  })
})
