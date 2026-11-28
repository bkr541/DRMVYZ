import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { ARC_ANGEL_PATTERNS, arcAngelPatternWeights, arcAngelPose, blendArcAngelPose } from '../modules/arcAngel/ArcAngelDomain'
import { arcAngelClipTime, arcAngelStageCue, blendArcAngelStage } from '../modules/arcAngel/ArcAngelPatterns'
import { CINEMA2_ARC_ANGEL_PRESET_MANIFEST as manifest } from '../presets/Cinema2ArcAngelPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { MOOD_CAPABILITIES, moodTwin } from './support/MoodMigrationHarness'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import type { Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'

describe('ARC ANGEL native authoring', () => {
  it('compiles with shared facilities and uses the four standard Design groups', () => {
    const result = compileCinema2NativePreset(manifest, { availableCapabilities: MOOD_CAPABILITIES })
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true)
    expect(new Set(manifest.parameters!.filter(p => p.section === 'Design').map(p => p.designParentGroup))).toEqual(new Set(['master-controls','design','effects','palette']))
    const parameter = (key: string) => manifest.parameters!.find(p => p.id === `arc-angel-${key}`)!
    expect(parameter('auto-performance').defaultValue).toBe(false)
    expect(parameter('pattern-change').defaultValue).toBe(false)
    expect(parameter('bpm-sync').defaultValue).toBe(true)
    expect(parameter('trigger')).toMatchObject({ options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS })
  })
  it('authors twelve distinct, bounded beat-space programs', () => {
    const signatures = ARC_ANGEL_PATTERNS.map(({value}) => JSON.stringify(Array.from({length:64},(_,i)=>arcAngelPose(value,i/4,i%10,i%7))))
    expect(new Set(signatures).size).toBe(12)
    for(const {value} of ARC_ANGEL_PATTERNS) for(let i=0;i<64;i++) {
      const pose=arcAngelPose(value,i/4,i%10,i%7)
      expect(pose.time).toBeGreaterThan(0)
      expect(pose.time).toBeLessThan(14.58)
      expect(Object.values(pose).every(Number.isFinite)).toBe(true)
    }
  })
  it('authors distinct spatial programs and keeps spatial crossfades bounded', () => {
    const signatures = ARC_ANGEL_PATTERNS.map(({value})=>JSON.stringify(Array.from({length:48},(_,i)=>arcAngelStageCue(value,i/4,i%12,i%4))))
    expect(new Set(signatures).size).toBe(12)
    for(const {value} of ARC_ANGEL_PATTERNS)for(let i=0;i<96;i++){
      const cue=blendArcAngelStage(arcAngelPatternWeights(value,'awakening',i/96),i/4,i%12,i%4)
      expect(Object.values(cue).every(v=>Number.isFinite(v)&&v>=-1e-8&&v<=1+1e-8)).toBe(true)
    }
  })
  it('samples a broader authored clip range while retaining lockoff and duration bounds', () => {
    expect(arcAngelClipTime(14.58,12,3,0)).toBeCloseTo(4)
    expect(arcAngelClipTime(14.58,8,0,1)).toBeGreaterThan(10)
    for(const duration of [3,14.58,20])for(const time of [-2,0,4,8,14,18]){
      const sample=arcAngelClipTime(duration,time,2,1)
      expect(sample).toBeGreaterThan(0);expect(sample).toBeLessThan(duration)
    }
  })
  it('declares all six shared camera modes and keeps paths inside the chamber', () => {
    const camera=manifest.cameras![0]!
    expect(camera.rig?.kind).toBe('path')
    expect(Object.keys(camera.rigVariants??{})).toHaveLength(6)
    for(const rig of Object.values(camera.rigVariants??{}))if(rig.kind==='path')for(const point of rig.points){
      expect(Math.hypot(point.position[0],point.position[2])).toBeLessThan(17)
      expect(point.position[1]).toBeGreaterThan(-4)
      expect(point.position[1]).toBeLessThan(9)
    }
  })
  it('preserves normalized weights through interrupted transitions', () => {
    const old=arcAngelPatternWeights('judgment','awakening',.42)
    expect(arcAngelPatternWeights('eclipse','judgment',0,old)).toEqual(old)
    for(let i=0;i<=10;i++) {
      const weights=arcAngelPatternWeights('eclipse','judgment',i/10,old)
      expect(weights.reduce((a,b)=>a+b,0)).toBeCloseTo(1)
      expect(Object.values(blendArcAngelPose(weights,4,2,3)).every(Number.isFinite)).toBe(true)
    }
  })
  it('can run the shared mood harness without changing the authored manifest', () => {
    const before=JSON.stringify(manifest)
    const twin=moodTwin(manifest,'arc-angel-auto-performance' as Cinema2ParameterId)
    twin.play(6,{energy:.85,build:.9,section:'build'})
    twin.play(6,{energy:.95,section:'drop'})
    expect(JSON.stringify(manifest)).toBe(before)
  })
  const source='.asset-sources/arc-angel/angel.glb'
  it.skipIf(!existsSync(source))('preserves all ten arm rigs, original tracks and local source fingerprint',()=>{
    const bytes=readFileSync(source)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe('5b03dfe8eb72f6b487b84b8154da7b5bfb1ea3c8618a65f06731319049dae84c')
    expect(bytes.readUInt32LE(0)).toBe(0x46546c67)
    const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)))
    expect(json.skins).toHaveLength(11)
    expect(json.animations[0].channels).toHaveLength(711)
    expect(json.meshes).toHaveLength(20)
    expect(json.images).toHaveLength(8)
  })
})
