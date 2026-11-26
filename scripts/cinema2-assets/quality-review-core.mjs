// Shared SYS-04 / VIS-01 review policy. No luminance floor or coverage target.
import { inventory, equalSet, capabilityPlan } from './reviewed-release-inventory.mjs'
export const reviewVersion = 2
export const subjects = Object.freeze({
  colossus: ['Four articulated industrial arms / model aperture', 'Arm tips and floor', 'Articulated arms and optional model', 'Industrial chamber', 'Four-arm silhouette around unobstructed center', 'Seams and key/rim light reveal joints; retain dark recesses', 'Preserve aperture and arm clearances; verify model material when supplied'],
  exoskeleton: ['Adaptive hinged armor / model aperture', 'Front aperture and armor edges', 'Segmented shell and optional model', 'Vertical service chamber', 'Open armor silhouette around model', 'Interior seams and selective rim reveal plate thickness', 'Check plate overlap, model clearance and original materials when supplied'],
  seraph: ['Six articulated celestial wings', 'Near wing blades', 'Wing roots and halo', 'Monumental cathedral', 'Six wings remain readable against architecture', 'Warm metal and core emission separate wing layers', 'Retain wing tips and meaningful halo articulation'],
  paradox: ['Interwoven mathematical ribbon trusses', 'Near ribbon cross sections', 'Nested rotating loops', 'Faceted optical chamber', 'Distinct nested loops, not a merged mass', 'Cool metal and strand emission separate interwoven paths', 'Inspect occlusion and layer separation during rotation'],
  relic: ['Mechanical skull and hinged jaw', 'Jaw and containment arcs', 'Cranial plates and eye sockets', 'Containment chamber', 'Readable skull, jaw and socket silhouette', 'Socket borders and core accent reveal skull volume', 'Check jaw and fragments through motion; retain skull recognition'],
  monolith: ['Branching radial alien intelligence', 'Near tendrils and blade edges', 'Radial branches and core cage', 'Monumental room', 'Coherent radial truss silhouette', 'Sequential branch accents preserve structural depth', 'Check tendril tips and core during deployment'],
  honey: ['Beveled industrial honeycomb wall', 'Near plate bevels', 'Hex plates and recessed chambers', 'Substrate and cavity depth', 'Legible hex tiling, physical extrusion and eight distinct formations', 'Local emissions and shadows reveal bevels and recesses', 'Close framing may crop repeating tiles intentionally; avoid clipping focal cavity'],
  spectrum: ['Distributed spectrum arena', 'Near arena fixtures', 'Distributed spectrum banks', 'Arena architecture', 'Readable arena rather than isolated bright pixels', 'Separate lit banks and architectural depth', 'Check distributed response and focal clearance'],
  everywhere: ['Default eyes and readable media', 'Eye and media surfaces', 'Layered display geometry', 'Surrounding environment', 'Default eyes remain recognizable; supplied media is legible', 'Use selective accents without tinting media', 'Check default and source changes; preserve aspect and alpha'],
  chamber: ['Dark chamber with imported model fidelity', 'Near chamber details', 'Model and its framing', 'Chamber enclosure', 'Model silhouette remains readable', 'Preserve original material colors and alpha under lighting', 'Check model scale, transparency and placement'],
  corridor: ['Purposeful media display roles in a corridor', 'Near panels', 'Hero and complementary displays', 'Receding corridor', 'Clear hierarchy between display roles', 'Preserve original media color and local lighting', 'Check moving panels, source visibility and clipping'],
  'crate-wireframe-portal': ['Layered wireframe portal', 'Near structural frames', 'Portal and intermediate geometry', 'Far wireframe structure', 'Complexity at foreground, midground and background', 'Selective lines reveal separate depth planes', 'Check spatial coverage and focal opening through motion'],
  fracture: ['Intact architecture, spatial rupture and reform', 'Near separated fragments', 'Rupture and intact structure', 'Far spatial layers', 'Readable intact/rupture/reform phases', 'Light reveals separation and reassembly', 'Check coherent restoration and fragment clearance'],
  hud: ['HUD with complementary instrumentation', 'Near instrumentation', 'Primary display and supporting indicators', 'Depth and supporting field', 'Fill negative space without crowding the hero', 'Keep primary and secondary hierarchy readable', 'Check instrumentation does not obscure focal content'],
  livewire: ['Readable text in a living LED environment', 'Near LED elements', 'Text and animated surroundings', 'Living background depth', 'Text remains readable against supporting activity', 'Separate lettering and environmental light', 'Check camera movement and text clearance'],
  monument: ['Monumental hero and architectural typography', 'Near architecture', 'Hero model or native lettering', 'Monumental environment', 'Hero retains scale and typography restores after model removal', 'Reveal hero with selective architectural lighting', 'Check model framing and native text restoration; not MONOLITH'],
  purity: ['Continuous forward flight', 'Passing near geometry', 'Forward route and mid-depth structures', 'Far vanishing region', 'Uninterrupted perceived forward motion in every formation', 'Depth accents reinforce direction', 'Inspect sequential frames for stalls, reversals or clipping'],
  refraction: ['Layered optical architecture', 'Near optical surfaces', 'Prismatic structures', 'Receding optical layers', 'Distinct layered optical identity, not generic emissive geometry', 'Refraction-like accents reveal layers', 'Check optical separation and meaningful pattern changes'],
  mosaic: ['Kinetic modular media wall', 'Chamfered tile housings', 'Independent moving screens and UV crops', 'Recessed service wall', 'Coherent screen wall through scatter and reconstruction', 'Frame accents preserve media color', 'Check depth extrusion, grouping and crop continuity'],
  overdrive: ['Radial cybernetic machine with ribbed LED core', 'Articulated pistons', 'Core and acoustic drivers', 'Radial machine architecture', 'Readable mechanical hierarchy across twelve programs', 'Core and mechanical accents reveal articulation', 'Check pistons, drivers and media display clearance'],
  allstar: ['Sixfold metallic hexagonal corridor', 'Recycled near rails and fixtures', 'Nested emissive polygon and star frames', 'Receding corridor segments', 'Recognizable sixfold passage and distinct twelve programs', 'Magenta architecture, cyan geometry and selective accents', 'Check forward depth, subtle sway, not orbit or screen-space kaleidoscope'],

})
if (!equalSet(Object.keys(subjects), inventory)) throw Error('VIS-01 rubric inventory mismatch')
export const criteria = ['subjectLegibility','negativeSpace','depthParallax','selectiveLighting','patternDistinction','mediaFidelity','noClipping','meaningfulMotion','consistency','distinctIdentity']
export const cases = ['authored','manual','auto'].flatMap(mode => ['landscape','portrait'].map(aspect => `${mode}/${aspect}`))
export const caseKey = report => `${report.config.mode}/${report.config.aspect}`
export const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
export const same = (a,b) => JSON.stringify(a) === JSON.stringify(b)
export const checkpoints = Object.freeze([
  ['reference',1], ['idle',15], ['idle',30],
  ...['build','drop','breakdown'].flatMap(stage=>[1,4,...Array(11).fill(5)].map(count=>[stage,count])),
])
export function inspectPixels(rgb) {
  if (!rgb.length || rgb.length % 3) throw Error('Expected nonempty RGB pixels')
  let variation = 0, min = 255, max = 0, sum = 0
  for (let i = 0; i < rgb.length; i++) {
    const value = rgb[i]
    min = Math.min(min, value); max = Math.max(max, value); sum += value
    variation = Math.max(variation, Math.abs(value - rgb[i % 3]))
  }
  // A uniform colored canvas is not a visible scene. A dark but spatially
  // varied scene is not failed. Flat output is a diagnostic, not aesthetic approval.
  return { uniform: variation === 0, spatialVariation: variation, min, max, mean: sum / rgb.length }
}
export function pendingRubric() {
  return Object.fromEntries(criteria.map(key => [key, { status: 'pending', evidence: [], reason: '' }]))
}
export function comparable(a, b) {
  return Boolean(a?.inventory && b?.inventory) && same(a.config,b.config) && same(a.environment,b.environment) &&
    a.inventory.id === b.inventory.id && same(JSON.parse(a.inventory.parameters).values,JSON.parse(b.inventory.parameters).values) &&
    same(a.inventory.metadata,b.inventory.metadata) && same(a.inventory.patterns,b.inventory.patterns) &&
    same(a.frames.map(f => [f.name,f.stage,f.stageFrame,f.musicTime,JSON.parse(f.settings).values]),b.frames.map(f => [f.name,f.stage,f.stageFrame,f.musicTime,JSON.parse(f.settings).values]))
}
export function validateCapture(report,id) {
  const c=report?.config
  if(report?.schemaVersion!==reviewVersion || !digest(report.hash) || !digest(report.sourceRevision) || report.inventory?.id!==id || !report.inventory.revision ||
    !c || !cases.includes(caseKey(report)) || c.fixture!=='sys04-review-v1' || c.quality!=='high' || c.fps!==30 || c.dpr!==1 ||
    !same([c.width,c.height],c.aspect==='landscape'?[960,540]:[540,960]) || !same(c.checkpoints,checkpoints) ||
    !report.environment?.chromium || !report.environment?.gl || report.complete!==true || report.errors?.length!==0 || report.disposed?.phase!=='disposed' ||
    !Array.isArray(report.frames) || report.frames.length!==checkpoints.length || !digest(report.contactSheet?.sha256) || !same(report.contactSheet.order,report.frames.map(f=>f.name))) throw Error('Incomplete or failed capture record')
  for(const [i,[stage,count]] of checkpoints.entries()) {
    const f=report.frames[i], name=`${String(i).padStart(2,'0')}-${stage}.png`
    if(f?.name!==name || f.stage!==stage || f.failed!==false || !digest(f.sha256) || !f.pixels || typeof f.pixels.uniform!=='boolean' ||
      !Number.isFinite(f.musicTime) || !Number.isSafeInteger(f.stageFrame) || f.timings?.length!==count || f.parametersUnchanged!==true ||
      f.settings!==report.inventory.parameters || !same([f.diagnostics?.runtime?.viewport?.width,f.diagnostics?.runtime?.viewport?.height],[c.width,c.height]) || (i===0 && f.pixels.uniform)) throw Error(`Incomplete or failed capture frame: ${name}`)
  }
}
export function catalogPath(id) {
  if(!inventory.some(key=>id===`drmvyz.cinema2.${key}`)) throw Error('Preset not in reviewed catalog')
  return `public/preset-artwork/${encodeURIComponent(id)}.webp`
}
export function evidenceIndex(bundle) {
  const entries=[]
  for(const side of ['baseline','candidate']) {
    for(const report of bundle[side]) entries.push({ref:`${side}/${caseKey(report)}/contact-sheet.png`,sha256:report.contactSheet.sha256})
    for(const f of [...bundle[`${side}Matrix`].frames,...(bundle[`${side}Matrix`].editorReferences??[])]) entries.push({ref:`${side}/matrix/${f.file}`,sha256:f.sha256})
  }
  return entries
}
export function validateBundle(bundle,currentRevision) {
  const {id,baseline,candidate,baselineMatrix,candidateMatrix}=bundle
  catalogPath(id)
  for(const reports of [baseline,candidate]) {
    if(!equalSet(reports.map(caseKey),cases))throw Error('Missing required authored/manual/auto landscape/portrait captures')
    for(const r of reports)validateCapture(r,id)
    if(!reports.every(r=>r.sourceRevision===reports[0].sourceRevision))throw Error('Mixed capture revisions')
  }
  for(const a of baseline)if(!comparable(a,candidate.find(b=>caseKey(a)===caseKey(b))))throw Error('Capture configurations or authored settings differ')
  if(candidate[0].sourceRevision!==currentRevision || candidateMatrix.sourceRevision!==currentRevision || baselineMatrix.sourceRevision!==baseline[0].sourceRevision)throw Error('Stale or mismatched source revision')
  const frameConditions=f=>[f.file,JSON.parse(f.settings).values,f.stage,f.stageFrame,f.musicTime,f.quality,f.fixture,f.diagnostics?.media?.slots?.map(s=>[s.id,s.source?.id,s.source?.kind])]
  if(!same(baselineMatrix.config,candidateMatrix.config)||!same(baselineMatrix.environment,candidateMatrix.environment)||
    !same(baselineMatrix.frames.map(frameConditions),candidateMatrix.frames.map(frameConditions)))throw Error('Incompatible technical baseline/candidate matrix')
  for(const [matrix,reports] of [[baselineMatrix,baseline],[candidateMatrix,candidate]]) {
    const authored=reports.find(r=>caseKey(r)==='authored/landscape').inventory
    if(!reports.every(r=>same(matrix.environment,r.environment))||matrix.manifest.id!==id||matrix.manifest.revision!==authored.revision||!same(matrix.manifest,authored))throw Error('Technical matrix manifest does not match authored capture')
    for(const [i] of authored.patterns.entries())for(const suffix of ['a-0','a-1','a-2','build','drop','hold'])if(!matrix.frames.some(f=>f.name===`pattern-${i}-${suffix}`))throw Error('Missing authored pattern sequence')
  }
  if(!['prospective','matched-older'].includes(bundle.baselineKind))throw Error('Declare baseline provenance')
}
export function binding(bundle) {
  return {version:reviewVersion,id:bundle.id,baselineKind:bundle.baselineKind,baselineRevision:bundle.baseline[0].sourceRevision,candidateRevision:bundle.candidate[0].sourceRevision,
    baselineHashes:bundle.baseline.map(r=>[caseKey(r),r.hash]),candidateHashes:bundle.candidate.map(r=>[caseKey(r),r.hash]),baselineMatrixHash:bundle.baselineMatrix.hash,candidateMatrixHash:bundle.candidateMatrix.hash}
}
export function validateApproval(review,bundle,currentRevision) {
  validateBundle(bundle,currentRevision)
  if(!same(review.binding,binding(bundle)))throw Error('Approval is not bound to these exact capture records and revision')
  if(typeof review.reference!=='string'||!review.reference.trim()||bundle.baselineKind==='matched-older'&&!review.baselineProvenance?.trim())throw Error('Document reference provenance')
  if(!review.reviewer?.trim() || !review.approvedAt || !Number.isFinite(Date.parse(review.approvedAt)) || review.decision!=='approved')throw Error('Explicit dated human approval required')
  const index=evidenceIndex(bundle), caps=capabilityPlan(bundle.candidateMatrix.manifest)
  for(const key of criteria) {
    const item=review.rubric?.[key]
    if(!item || !['pass','not-applicable'].includes(item.status) || !item.reason?.trim() || !Array.isArray(item.evidence) || !item.evidence.length ||
      item.evidence.some(e=>!index.some(f=>same(e,f))))throw Error(`Unresolved criterion or invalid evidence: ${key}`)
    if(item.status==='not-applicable'&&(key!=='mediaFidelity'||caps.model||Object.values(caps.media).some(s=>s.length)))throw Error(`Cannot waive ${key}`)
    for(const side of ['baseline','candidate']) {
      if(key==='patternDistinction')for(const [i] of bundle.candidateMatrix.manifest.patterns.entries()) {
        for(const n of [0,1,2])if(!item.evidence.some(e=>e.ref===`${side}/matrix/pattern-${i}-a-${n}.png`))throw Error('Missing pattern sequence review evidence')
      }
      if(key==='mediaFidelity'&&item.status==='pass') {
        for(const kind of ['image','video','svg'])if(caps.media[kind].length)for(const variant of kind==='image'?['chart','alpha','tall']:[kind])if(!item.evidence.some(e=>e.ref===`${side}/matrix/media-${variant}-high-breakdown-on.png`))throw Error('Missing source review evidence')
        if(caps.model&&!item.evidence.some(e=>e.ref===`${side}/matrix/model.png`))throw Error('Missing model review evidence')
      }
      if(!['patternDistinction','mediaFidelity'].includes(key))for(const c of cases)if(!item.evidence.some(e=>e.ref===`${side}/${c}/contact-sheet.png`))throw Error(`Missing ${c} sequence review evidence for ${key}`)
      if(key==='meaningfulMotion'&&(caps.camera.permission||caps.camera.mode))for(const mode of ['off','on','auto'])for(const n of [0,1,2,3,4])if(!item.evidence.some(e=>e.ref===`${side}/matrix/camera-${mode}-${n}.png`))throw Error('Missing selected camera sequence evidence')
    }
  }
  const report=bundle.candidate.find(r=>caseKey(r)==='authored/landscape')
  const frame=report.frames.find(f=>f.name===review.thumbnailFrame)
  if(!frame || frame.failed || frame.pixels.uniform)throw Error('Select a nonblank authored landscape candidate frame')
  return {frame,report,path:catalogPath(bundle.id)}
}
