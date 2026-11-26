import { inspectPixels, subjects } from './quality-review-core.mjs'

// Superset of review anchors in SYS-03/04/05 and the named SYS-06 harnesses.
// The original Review 01 document was not supplied, so this is deliberately
// not represented as a verified transcription of its sixteen names.
export const inventory = Object.freeze([
  ...Object.keys(subjects), 'spectrum', 'corridor', 'everywhere', 'fracture', 'refraction', 'mosaic', 'overdrive',
  'hud', 'purity', 'livewire', 'crate-wireframe-portal', 'allstar',
])
export const config = Object.freeze({ fixture: 'sys06-v1/sys04-review-v1', fps: 30, dpr: 1, width: 960, height: 540, quality: 'high' })
export function pixelEvidence(rgb, width, height) {
  if (rgb.length !== width * height * 3 || !width || !height) throw Error('Unexpected RGB dimensions')
  const zones = Array.from({ length: 9 }, () => ({ min: 255, max: 0, chromatic: 0, lit: 0, count: 0 }))
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 3, r = rgb[i], g = rgb[i + 1], b = rgb[i + 2]
    const z = zones[Math.floor(y / height * 3) * 3 + Math.floor(x / width * 3)], hi = Math.max(r,g,b), lo = Math.min(r,g,b)
    z.min = Math.min(z.min, hi); z.max = Math.max(z.max, hi); z.count++
    if (hi > 45) z.lit++
    if (hi > 55 && hi - lo > 20) z.chromatic++
  }
  return { ...inspectPixels(rgb), zones, litFraction: zones.reduce((n,z)=>n+z.lit,0)/(width*height),
    chromaticPixels: zones.reduce((n,z)=>n+z.chromatic,0), chromaticZones: zones.filter(z=>z.chromatic>0).length }
}
export function visibleIssues(key, pixels, stage) {
  // No global brightness floor: dark, spatially varied artwork is valid.
  // Individual musical transition frames may be dark; callers separately
  // require a visible default and a visible sustained performance checkpoint.
  if (pixels.uniform || pixels.spatialVariation < 2) return ['No spatially distinguishable scene']
  // Existing SPE-01 arena criterion is specific to the default source, not
  // arbitrary dark/monochrome media or a deliberately dark pattern.
  if (key === 'spectrum' && stage === 'default' && (pixels.litFraction <= .005 || pixels.chromaticPixels <= 100 || pixels.chromaticZones < 2)) return ['SPECTRUM default lacks distributed arena lighting']
  return []
}
export function pixelDistance(a,b) {
  if (a.length !== b.length || !a.length) throw Error('Mismatched pixel buffers')
  let sum = 0, changed = 0
  for (let i=0;i<a.length;i+=3) {
    const delta = Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))
    sum += delta; if(delta>=8) changed++
  }
  return { mean: sum/(a.length/3), fraction: changed/(a.length/3) }
}
export function controlEvidence(a1,a2,b) {
  const noise = pixelDistance(a1,a2), change = pixelDistance(a2,b)
  // Drift measured under identical saved settings is not evidence of a control.
  const pass = change.mean > Math.max(.25,noise.mean*2) && change.fraction > Math.max(.001,noise.fraction*2)
  return { pass, noise, change }
}
export function technicalIssues(capture) {
  const d=capture.diagnostics
  return [!capture.parametersUnchanged && 'Saved settings mutated', d.runtime.phase!=='running' && `Runtime ${d.runtime.phase}`,
    d.glErrors.length && `GL errors: ${d.glErrors.join(',')}`, d.modules.failedModuleCount && 'Failed module',
    d.render.failedPassCount && 'Failed render pass', d.modules.modules.some(m=>m.inspection?.ready===false||m.inspection?.renderReady===false) && 'Module not ready',
    d.media.errorCount && 'Media slot error'].filter(Boolean)
}
export function retiredIssues(d) {
  return [d.runtime.phase!=='disposed' && 'Retired runtime not disposed', Object.values(d.runtime.resources).some(Boolean) && 'Retired runtime owns handles',
    d.modules.activeResourceLeaseCount!==0 && 'Retired module leases', d.modules.estimatedGpuBytes!==0 && 'Retired module GPU bytes',
    d.resources.activeLeaseCount!==0 && 'Retired render target leases', d.resources.estimatedGpuMemoryBytes!==0 && 'Retired render target bytes',
    d.media.readyResourceCount!==0 && 'Retired media textures', d.glErrors.length>0 && 'Retired runtime had GL errors'].filter(Boolean)
}
export function p95(values) {
  if (!values.length || values.some(v=>!Number.isFinite(v)||v<0)) throw Error('Invalid timing samples')
  return [...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1]
}
export function regressionIssues(before,after) {
  const issues=[]
  if (JSON.stringify(before.config)!==JSON.stringify(after.config) || JSON.stringify(before.environment)!==JSON.stringify(after.environment) || JSON.stringify(before.inventory)!==JSON.stringify(after.inventory)) return ['Incomparable capture configuration, environment or inventory']
  for (const key of after.inventory) {
    const a=before.presets[key], b=after.presets[key]
    if(a?.status!=='pass'||b?.status!=='pass'){issues.push(`${key}: missing/pending/failed comparison evidence`);continue}
    for (const name of Object.keys(a.metrics)) {
      const x=a.metrics[name], y=b.metrics[name]
      if(!y || x.settings!==y.settings || x.width!==y.width || x.height!==y.height){issues.push(`${key}/${name}: missing or different capture settings`);continue}
      // Conservative release tripwires, not a GPU FPS claim. Absolute slack
      // prevents noise near zero dominating the comparison.
      if(y.cpuP95>x.cpuP95*1.5+2) issues.push(`${key}/${name}: CPU callback p95 regression`)
      if(y.gpuBytes>x.gpuBytes*1.25+4*1024*1024) issues.push(`${key}/${name}: estimated GPU allocation regression`)
    }
  }
  return issues
}
