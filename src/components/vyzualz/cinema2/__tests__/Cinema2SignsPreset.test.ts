import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { CINEMA2_SIGNS_PRESET_ID, CINEMA2_SIGNS_PRESET_MANIFEST as manifest, signsParameterId } from '../presets/Cinema2SignsPreset'
import { CINEMA2_SIGNS_MODULE_TYPE_ID, Cinema2SignsController } from '../modules/Cinema2SignsNativeModule'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { SIGNS_PATTERNS, signsMask } from '../modules/signs/SignsPatterns'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import { moodTwin } from './support/MoodMigrationHarness'

describe('SIGNS native preset', () => {
  it('registers a first-party preset with all required groups, controls and canonical triggers', () => {
    expect(cinema2NativePresetRegistry.compile(CINEMA2_SIGNS_PRESET_ID).ok).toBe(true)
    expect(cinema2NativeModuleRegistry.get(CINEMA2_SIGNS_MODULE_TYPE_ID, 1)).toBeTruthy()
    expect(validateCinema2PresetAuthoringConventions({ role: 'reference', manifest }).diagnostics).toEqual([])
    expect(new Set(manifest.parameters!.map(p => p.designParentGroup))).toEqual(new Set(['master-controls', 'design', 'effects', 'palette']))
    expect(manifest.parameters!.filter(p => p.designParentGroup === 'palette')).toHaveLength(5)
    const trigger = manifest.parameters!.find(p => p.id === signsParameterId('trigger'))!
    expect(trigger.options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(trigger.options).toHaveLength(11)
    expect(trigger.visibleWhen).toEqual([{ kind: 'parameter-equals', parameterId: signsParameterId('patternChange'), value: true }])
  })
  it('ships the original GLB unchanged with its rotation animation, two meshes and emissive texture', () => {
    const bytes = readFileSync('public/cinema2/models/signs.glb')
    expect(createHash('sha256').update(bytes).digest('hex')).toBe('4cfa0d05a5125e7fe3cc9a63f601245028e9630502699c663ed75ac0c7d44a3a')
    const source = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'))
    expect(source.meshes).toHaveLength(2)
    expect(source.animations[0].channels[0].target.path).toBe('rotation')
    expect(source.materials[1].emissiveTexture.index).toBe(1)
  })
  it('authors eight distinct bounded spatial scores and visible temporal change', () => {
    const samples = SIGNS_PATTERNS.map(pattern => Array.from({ length: 64 }, (_, i) => signsMask(pattern, i / 64, (i % 13) / 13, .17)))
    expect(new Set(samples.map(s => JSON.stringify(s))).size).toBe(8)
    expect(samples.flat().every(n => Number.isFinite(n) && n >= 0 && n <= 1)).toBe(true)
    for (const pattern of SIGNS_PATTERNS) expect(signsMask(pattern, .13, .42, .2)).not.toBeCloseTo(signsMask(pattern, .13, .42, .43), 5)
  })
  it('consumes fresh events only, preserves manual pattern change, freezes on pause, resets on new track', () => {
    const controller = new Cinema2SignsController({ THREE } as unknown as Cinema2ThreeLibrary)
    const values = new Map(Object.entries(manifest.modules![0]!.parameters!))
    values.set('patternChange', true); values.set('trigger', 'kick')
    let tick = 0, time = 0, track = 'a'
    const update = (kick: string | null, paused = false) => {
      tick++; if (!paused) time += .05
      controller.update({ parameters: { get: (key: string) => values.get(key), getEditRevision: () => 0 }, frame: {
        timestampMs: tick * 50, deltaTimeSec: .05, elapsedTimeSec: time, contextGeneration: 1,
        transport: { sourcePresent: true, playing: !paused, paused, animationActive: !paused, trackId: track, timeSec: time, bpm: 120 },
        audio: { upstream: { timeSec: time }, rhythm: { kick: kick ? { id: kick } : null }, structure: { semanticMoments: { available: false } } }, director: null, mood: null,
      } } as unknown as Cinema2ModuleUpdateContext)
      return controller.inspect()
    }
    expect(update(null).pattern).toBe('signal-breath')
    const first = update('k1'); expect(first.pattern).toBe('radial-relay')
    expect(update('k1').pattern).toBe(first.pattern)
    const before = update(null); expect(update('k2', true).phase).toBe(before.phase)
    expect(update('k2').pattern).toBe(first.pattern)
    expect(update('k3').pattern).toBe('counter-sweep')
    values.set('pattern', 'orbit-code'); expect(update('k3').pattern).toBe('orbit-code')
    expect(values.get('patternChange')).toBe(true)
    expect(update('k4').pattern).toBe('afterimage')
    track = 'b'; expect(update('k4').pattern).toBe('orbit-code')
    controller.dispose()
  })
  it('uses shared resolved choreography and mood drives rather than a second analyser', () => {
    const twin = moodTwin(manifest, signsParameterId('autoPerformance'))
    twin.play(3, { energy: .75, section: 'build', build: .8 })
    expect(twin.on.read('signs-scene', 'chaseDepth')).not.toBeCloseTo(twin.off.read('signs-scene', 'chaseDepth'), 5)
    expect(twin.off.read('signs-scene', 'chaseDepth')).toBeCloseTo(twin.stripped.read('signs-scene', 'chaseDepth'), 7)
  })
})
