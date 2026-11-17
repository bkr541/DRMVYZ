import { describe, expect, it } from 'vitest'
import { CINEMA2_MOOD_TRIGGER_LADDER, readCinema2MoodPolicy, validateCinema2MoodPolicyParameters } from '../conductor/Cinema2MoodPolicy'
import type { Cinema2MoodFrame } from '../conductor/Cinema2MoodConductor'
import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import type { Cinema2NativePresetManifest, Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_DEPTH_AUTO_PERFORMANCE_ID, CINEMA2_DEPTH_PATTERN_CHANGE_ID, CINEMA2_DEPTH_PRESET_MANIFEST, CINEMA2_DEPTH_TRIGGER_ID } from '../presets/Cinema2DepthPreset'
import { CINEMA2_MAINFRAME_AUTO_PERFORMANCE_ID, CINEMA2_MAINFRAME_PATTERN_CHANGE_ID, CINEMA2_MAINFRAME_PRESET_MANIFEST, CINEMA2_MAINFRAME_TRIGGER_ID } from '../presets/Cinema2MainframePreset'
import { tagCinema2MoodPolicies, withCinema2MoodDrives } from '../presets/Cinema2MoodConductorAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'

const CAPABILITIES = [
  'render.webgl2', 'render.depth', 'render.history', 'scene.3d', 'camera.world', 'lighting', 'audio.bands', 'audio.features', 'music.beat', 'music.downbeat', 'music.bar',
  'music.rhythm-events', 'music.phrase', 'music.section', 'music.drop', 'visual-director.significance', 'media.image', 'media.video', 'media.svg',
] as const

const compile = (manifest: Readonly<Cinema2NativePresetManifest>) => compileCinema2NativePreset(manifest, { availableCapabilities: CAPABILITIES })
const policyOf = (manifest: Readonly<Cinema2NativePresetManifest>, id: Cinema2ParameterId) => readCinema2MoodPolicy(manifest.parameters!.find(parameter => parameter.id === id)?.metadata)

const moodWith = (pattern: Cinema2MoodFrame['pattern']) => ({ pattern } as unknown as Cinema2MoodFrame)
const options = (values: readonly string[]) => values.map(value => ({ value, label: value }))

describe('the shared Pattern Change / Trigger policy', () => {
  describe('authoring', () => {
    it('tags Depth and Mainframe through the spec, with the Auto Performance toggle too, and both still compile', () => {
      for (const [manifest, pc, tr, auto] of [
        [CINEMA2_DEPTH_PRESET_MANIFEST, CINEMA2_DEPTH_PATTERN_CHANGE_ID, CINEMA2_DEPTH_TRIGGER_ID, CINEMA2_DEPTH_AUTO_PERFORMANCE_ID],
        [CINEMA2_MAINFRAME_PRESET_MANIFEST, CINEMA2_MAINFRAME_PATTERN_CHANGE_ID, CINEMA2_MAINFRAME_TRIGGER_ID, CINEMA2_MAINFRAME_AUTO_PERFORMANCE_ID],
      ] as const) {
        expect(policyOf(manifest, pc)).toBe('patternChange')
        expect(policyOf(manifest, tr)).toBe('trigger')
        expect(policyOf(manifest, auto)).toBe('autoPerformance')
        expect(manifest.parameters!.filter(parameter => readCinema2MoodPolicy(parameter.metadata) != null)).toHaveLength(3)
        expect(compile(manifest).ok).toBe(true)
      }
    })

    it('keeps the metadata a parameter already had (Depth\'s edit rule turns Auto Performance off)', () => {
      const pc = CINEMA2_DEPTH_PRESET_MANIFEST.parameters!.find(parameter => parameter.id === CINEMA2_DEPTH_PATTERN_CHANGE_ID)!
      expect(pc.metadata).toMatchObject({ moodPolicy: 'patternChange', userEditSetParameters: { [CINEMA2_DEPTH_AUTO_PERFORMANCE_ID]: false } })
    })

    it('tags without any drives, keeps the revision, and leaves the original manifest alone', () => {
      const before = JSON.stringify(CINEMA2_MAINFRAME_PRESET_MANIFEST)
      const tagged = withCinema2MoodDrives(CINEMA2_MAINFRAME_PRESET_MANIFEST, {
        idPrefix: 'x', enabledParameter: CINEMA2_MAINFRAME_AUTO_PERFORMANCE_ID, drives: [],
        patternControls: { patternChange: CINEMA2_MAINFRAME_PATTERN_CHANGE_ID, trigger: CINEMA2_MAINFRAME_TRIGGER_ID },
      })
      expect(tagged.revision).toBe(CINEMA2_MAINFRAME_PRESET_MANIFEST.revision)
      expect(JSON.stringify(CINEMA2_MAINFRAME_PRESET_MANIFEST)).toBe(before)
      expect(policyOf(tagged, CINEMA2_MAINFRAME_TRIGGER_ID)).toBe('trigger')
    })

    it('throws on a parameter id that is not in the manifest instead of silently leaving the preset untagged', () => {
      expect(() => tagCinema2MoodPolicies(CINEMA2_MAINFRAME_PRESET_MANIFEST, { 'no-such-parameter': 'trigger' })).toThrow(/no-such-parameter/)
    })
  })

  describe('compiler validation', () => {
    const baseline = () => [
      { type: 'boolean', metadata: { moodPolicy: 'patternChange' } },
      { type: 'enum', metadata: { moodPolicy: 'trigger' }, options: options(['beat', 'kick', 'bar', 'bar4', 'bar8', 'beat2', 'phrase']) },
      { type: 'boolean', metadata: { moodPolicy: 'autoPerformance' } },
    ]
    const codes = (parameters: readonly object[]) => validateCinema2MoodPolicyParameters(parameters).map(d => d.code)

    it('accepts a complete, well-typed set, and presets with no tags at all', () => {
      expect(codes(baseline())).toEqual([])
      expect(codes([{ type: 'float' }, { type: 'boolean', metadata: { other: 1 } }])).toEqual([])
    })

    it('rejects a Trigger that cannot hold every value the music may choose, naming what is missing', () => {
      const parameters = baseline(); parameters[1] = { ...parameters[1]!, options: options(['beat', 'bar', 'bar4']) } as never
      const found = validateCinema2MoodPolicyParameters(parameters)
      expect(found.map(d => d.code)).toEqual(['CINEMA2_PRESET_MOOD_POLICY_TRIGGER_OPTIONS'])
      expect(found[0]!.message).toContain('bar8')
      expect(found[0]!.message).toContain('beat2')
    })

    it('rejects wrong control kinds, unknown tags, duplicates and half-tagged presets', () => {
      const wrongType = baseline(); wrongType[0] = { type: 'enum', metadata: { moodPolicy: 'patternChange' } } as never
      expect(codes(wrongType)).toEqual(['CINEMA2_PRESET_MOOD_POLICY_TYPE'])
      expect(codes([...baseline(), { type: 'boolean', metadata: { moodPolicy: 'patternChange' } }])).toEqual(['CINEMA2_PRESET_MOOD_POLICY_DUPLICATE'])
      expect(codes([...baseline(), { type: 'boolean', metadata: { moodPolicy: 'bogus' } }])).toEqual(['CINEMA2_PRESET_MOOD_POLICY_UNKNOWN'])
      expect(codes(baseline().slice(0, 2))).toEqual(['CINEMA2_PRESET_MOOD_POLICY_INCOMPLETE'])
    })

    it('stops a real preset compiling when its tagged Trigger is missing a rung of the ladder', () => {
      const broken = {
        ...CINEMA2_MAINFRAME_PRESET_MANIFEST,
        parameters: CINEMA2_MAINFRAME_PRESET_MANIFEST.parameters!.map(parameter => parameter.id === CINEMA2_MAINFRAME_TRIGGER_ID
          ? { ...parameter, options: (parameter as { options: readonly { value: string }[] }).options.filter(option => option.value !== 'bar8') }
          : parameter),
      } as unknown as Cinema2NativePresetManifest
      const result = compile(broken)
      expect(result.ok).toBe(false)
      expect(result.diagnostics.some(d => d.code === 'CINEMA2_PRESET_MOOD_POLICY_TRIGGER_OPTIONS')).toBe(true)
    })

    it('the ladder is a subset of the canonical Trigger list every preset uses', () => {
      const canonical = new Set((CINEMA2_MAINFRAME_PRESET_MANIFEST.parameters!.find(parameter => parameter.id === CINEMA2_MAINFRAME_TRIGGER_ID) as unknown as { options: { value: string }[] }).options.map(option => option.value))
      for (const rung of CINEMA2_MOOD_TRIGGER_LADDER) expect(canonical.has(rung)).toBe(true)
    })
  })

  describe('Cinema2PatternControlResolver', () => {
    const saved = { patternChange: false, trigger: 'bar8' as const }
    const choice = { patternChange: true, trigger: 'beat' as const, reason: 'peak' as const }

    it('returns the music\'s choice while Auto Performance is on, and says so', () => {
      const resolver = new Cinema2PatternControlResolver<string>()
      expect(resolver.update({ saved, mood: moodWith(choice), autoPerformance: true })).toEqual({ patternChange: true, trigger: 'beat', automatic: true })
      expect(resolver.inspect()).toEqual({ effectivePatternChange: true, effectiveTrigger: 'beat', patternControlsAutomatic: true })
    })

    it('returns exactly the saved values with the toggle off, with no mood, or with no choice (no beat grid)', () => {
      const resolver = new Cinema2PatternControlResolver<string>()
      for (const [mood, auto] of [[moodWith(choice), false], [null, true], [undefined, true], [moodWith(null), true]] as const) {
        expect(resolver.update({ saved, mood, autoPerformance: auto })).toEqual({ patternChange: false, trigger: 'bar8', automatic: false })
      }
    })

    it('reports nothing before the first update and again after a reset, and never mutates what it was given', () => {
      const resolver = new Cinema2PatternControlResolver<string>()
      expect(resolver.current).toBeNull()
      expect(resolver.inspect()).toEqual({ effectivePatternChange: null, effectiveTrigger: null, patternControlsAutomatic: false })
      const inputSaved = Object.freeze({ ...saved })
      resolver.update({ saved: inputSaved, mood: moodWith(choice), autoPerformance: true })
      expect(inputSaved).toEqual(saved)
      resolver.reset()
      expect(resolver.current).toBeNull()
    })
  })
})
