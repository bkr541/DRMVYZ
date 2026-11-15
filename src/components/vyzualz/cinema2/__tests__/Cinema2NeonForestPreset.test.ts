import { describe, expect, it } from 'vitest'
import { CINEMA2_ASSET_RECORDS } from '../assets/Cinema2AssetManifest.generated'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { CINEMA2_NEON_FOREST_PRESET_MANIFEST as manifest } from '../presets/Cinema2NeonForestPreset'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { NEON_FOREST_CAMERA_RIGS, NEON_FOREST_PATTERNS } from '../modules/neonForest/Cinema2NeonForestDomain'

describe('NEON FOREST native production contract',()=>{
 it('registers for human review, validates generic authoring and compiles',()=>{
  expect(manifest.metadata.name).toBe('NEON FOREST')
  const declaration=CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(d=>d.manifest.id===manifest.id)!
  expect(declaration.role).toBe('reference')
  expect(validateCinema2PresetAuthoringConventions(declaration).diagnostics).toEqual([])
  expect(compileCinema2NativePreset(manifest).ok).toBe(true)
 })
 it('requires both persistent runtime-bound toggles under Master Controls',()=>{
  for(const label of ['BPM Sync','Auto Performance']){
   const p=manifest.parameters!.find(p=>p.label===label)!
   expect(p.type).toBe('boolean');expect(p.designParentGroup).toBe('master-controls');expect(p.persistence).toBe('preset')
   expect(manifest.modules!.some(m=>Object.values(m.parameterBindings??{}).some(r=>r.$ref===p.id))).toBe(true)
  }
 })
 it('authors eight patterns, canonical triggers, independent colors and depth-backed finishing',()=>{
  expect(NEON_FOREST_PATTERNS).toHaveLength(8)
  expect(new Set(NEON_FOREST_PATTERNS.map(p=>p.value)).size).toBe(8)
  const pattern=manifest.parameters!.filter(p=>['Pattern','Pattern Change','Trigger'].includes(p.label))
  expect(pattern.map(p=>p.label)).toEqual(['Pattern','Pattern Change','Trigger'])
  expect(pattern.every(p=>p.designParentGroup==='design')).toBe(true)
  expect(pattern[1].defaultValue).toBe(false);expect(pattern[2].options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
  expect(pattern[2].visibleWhen).toEqual([{kind:'parameter-equals',parameterId:pattern[1].id,value:true}])
  expect(manifest.parameters!.filter(p=>p.type==='color'&&p.designParentGroup==='palette')).toHaveLength(7)
  expect(manifest.render!.targets![0].descriptor.depthFormat).toBe('depth24')
  expect(manifest.effects!.map(e=>e.typeId)).toEqual(['reflective-floor','volumetric-atmosphere','hdr-bloom','cinematic-finish'])
 })
 it('uses safe authored travel and elevated rigs and an attributed complete asset on every tier',()=>{
  expect(Object.keys(NEON_FOREST_CAMERA_RIGS)).toEqual(['travel','elevated','orbit','fixed'])
  const asset=CINEMA2_ASSET_RECORDS.find(a=>a.id==='cinema2-neon-forest-static')!
  expect(asset.attribution).toContain('AnixMoon');expect(asset.license).toBe('CC-BY-4.0')
  expect(asset.files.high.triangles).toBeLessThan(250000)
  expect(manifest.lighting!.lights!.length).toBeLessThanOrEqual(12)
 })
})
