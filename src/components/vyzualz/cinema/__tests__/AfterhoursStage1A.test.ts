import { describe, expect, it } from 'vitest'
import {
  CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE,
  cinemaCinematicWorldParameterId,
  createCinemaCinematicWorldParameterSchemas,
  createCinemaCinematicWorldParameterValues,
  hydrateCinemaCinematicWorldConfigFromParameterValues,
} from '..'
import {
  CINEMATIC_WORLD_DOMAIN_MODES,
  CINEMATIC_WORLD_MODES,
  createCinematicWorldConfig,
  normalizeCinematicWorldConfig,
} from '../../react/CinematicWorldConfig'
import {
  AFTERHOURS_DEFAULTS,
  createDefaultCinematicWorldSettings,
  resolveAfterhoursSettings,
} from '../../react/CinematicWorldSettings'
import { DEFAULT_REACT_PRESETS } from '../../react/ReactTypes'
import { cinematicWorldDefinitions } from '../../react/renderers/cinematic/worlds'

describe('Afterhours Stage 1A contract and adapter foundation', () => {
  it('recognizes Afterhours in the domain and Stage 1B live registries', () => {
    expect(CINEMATIC_WORLD_DOMAIN_MODES).toContain('afterhours')
    expect(CINEMATIC_WORLD_MODES).toContain('afterhours')
    expect(DEFAULT_REACT_PRESETS.some(preset => preset.id === 'preset-afterhours')).toBe(true)
    expect(cinematicWorldDefinitions.some(definition => definition.id === 'afterhours')).toBe(true)
    expect(CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.some(entry => entry.worldId === 'afterhours')).toBe(true)
  })

  it('owns the complete final MVP defaults and disables generic audio routing', () => {
    expect(createDefaultCinematicWorldSettings('afterhours')).toEqual({
      mode: 'afterhours',
      settings: AFTERHOURS_DEFAULTS,
    })

    const config = createCinematicWorldConfig('afterhours', {})
    expect(config.worldMode).toBe('afterhours')
    expect(resolveAfterhoursSettings(config.worldSettings)).toEqual(AFTERHOURS_DEFAULTS)
    expect(config.audioMapping).toMatchObject({ enabled: false, routes: [] })
  })

  it('normalizes malformed Afterhours values, clamps sliders, and rounds Beam Count to 2-16', () => {
    const cases = [
      [-1, 2],
      [2, 2],
      [2.7, 3],
      [16, 16],
      [99, 16],
      [Number.NaN, 8],
    ] as const
    for (const [beamCount, expected] of cases) {
      const config = createCinematicWorldConfig('afterhours', { beamCount })
      expect(resolveAfterhoursSettings(config.worldSettings).beamCount).toBe(expected)
    }

    const normalized = normalizeCinematicWorldConfig({
      worldMode: 'afterhours',
      worldSettings: {
        mode: 'afterhours',
        settings: {
          backgroundColor: null,
          colorMode: 'future',
          primaryColor: '#ABC',
          accentColor: 'bad',
          accentMix: -4,
          pattern: 'triangle',
          symmetry: 'yes',
          sideLasers: true,
          topLasers: 1,
          beamCount: 11.6,
          spread: 4,
          atmosphere: -2,
          bpmSync: false,
          masterIntensity: 9,
          trigger: 'future',
          pulseAmount: -1,
          pulseDecay: 2,
          motionAmount: Number.NaN,
          patternChange: 'future',
          blackoutAmount: 99,
        },
      },
      environment: { fog: 0.21 },
      material: { bloom: 0.44 },
      compatibility: { extensions: { retained: 'yes' } },
    })
    expect(resolveAfterhoursSettings(normalized.worldSettings)).toEqual({
      ...AFTERHOURS_DEFAULTS,
      primaryColor: '#aabbcc',
      sideLasers: true,
      beamCount: 12,
      accentMix: 0,
      spread: 1,
      atmosphere: 0,
      bpmSync: false,
      masterIntensity: 1,
      pulseAmount: 0,
      pulseDecay: 1,
      blackoutAmount: 1,
    })
    expect(normalized.environment.fog).toBe(0.21)
    expect(normalized.material.bloom).toBe(0.44)
    expect(normalized.compatibility.extensions.retained).toBe('yes')
    expect(normalized.audioMapping).toMatchObject({ enabled: false, routes: [] })
  })

  it('materializes and hydrates every Afterhours setting through canonical Cinema adapter helpers', () => {
    const authored = createCinematicWorldConfig('afterhours', {
      backgroundColor: '#102030',
      colorMode: 'auto',
      primaryColor: '#74f5ff',
      accentColor: '#fedcba',
      accentMix: 0.41,
      pattern: 'xWall',
      symmetry: false,
      sideLasers: true,
      topLasers: true,
      beamCount: 15,
      spread: 0.81,
      atmosphere: 0.36,
      bpmSync: false,
      masterIntensity: 0.91,
      trigger: 'bar8',
      pulseAmount: 0.72,
      pulseDecay: 0.22,
      motionAmount: 0.68,
      patternChange: 'phrase',
      blackoutAmount: 0.47,
    }, {
      seed: 314159,
      environment: { fog: 0.19 },
      material: { bloom: 0.52 },
      compatibility: { extensions: { futureField: 'preserved' } },
    })
    const schemas = createCinemaCinematicWorldParameterSchemas('afterhours')
    const labels = schemas.map(schema => schema.label)
    expect(labels).toEqual(expect.arrayContaining([
      'Background Color', 'Color Mode', 'Primary Color', 'Accent Color', 'Accent Mix', 'Pattern',
      'Symmetry', 'Side Lasers', 'Top Lasers', 'Beam Count', 'Spread', 'Atmosphere', 'BPM Sync',
      'Master Intensity', 'Trigger', 'Pulse Amount', 'Pulse Decay', 'Motion Amount', 'Pattern Change', 'Blackout Amount',
    ]))
    expect(schemas.find(schema => schema.label === 'Beam Count')).toMatchObject({ type: 'integer', min: 2, max: 16, step: 1 })
    expect(schemas.find(schema => schema.label === 'Side Lasers')).toMatchObject({ type: 'boolean', default: false })
    expect(schemas.find(schema => schema.label === 'Trigger')?.group).toBe('React')
    expect(schemas.find(schema => schema.label === 'BPM Sync')?.group).toBe('React')
    expect(schemas.find(schema => schema.label === 'Pattern')?.type).toBe('enum')

    const values = createCinemaCinematicWorldParameterValues(authored, schemas)
    expect(values[cinemaCinematicWorldParameterId('world-beam-count')]).toBe(15)
    expect(values[cinemaCinematicWorldParameterId('world-side-lasers')]).toBe(true)
    expect(values[cinemaCinematicWorldParameterId('world-background-color')]).toEqual([16 / 255, 32 / 255, 48 / 255, 1])

    const hydrated = hydrateCinemaCinematicWorldConfigFromParameterValues('afterhours', values, authored)
    expect(hydrated.worldMode).toBe('afterhours')
    expect(resolveAfterhoursSettings(hydrated.worldSettings)).toEqual(resolveAfterhoursSettings(authored.worldSettings))
    expect(hydrated.environment.fog).toBe(0.19)
    expect(hydrated.material.bloom).toBe(0.52)
    expect(hydrated.compatibility.extensions.futureField).toBe('preserved')
    expect(hydrated.audioMapping).toMatchObject({ enabled: false, routes: [] })
  })

  it('leaves non-Afterhours configs unchanged by normalization', () => {
    const existing = createCinematicWorldConfig('electricStorm', {}, {
      audioMapping: { enabled: false, routes: [] },
    })
    expect(normalizeCinematicWorldConfig(JSON.parse(JSON.stringify(existing)))).toEqual(existing)
  })
})
