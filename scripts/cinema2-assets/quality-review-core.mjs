// Shared SYS-04 review policy. No luminance floor or coverage target.
export const subjects = Object.freeze({
  colossus: ['Four articulated industrial arms / model aperture', 'Arm tips and floor', 'Articulated arms and optional model', 'Industrial chamber', 'Four-arm silhouette around unobstructed center', 'Seams and key/rim light reveal joints; retain dark recesses', 'Preserve aperture and arm clearances; verify model material when supplied'],
  exoskeleton: ['Adaptive hinged armor / model aperture', 'Front aperture and armor edges', 'Segmented shell and optional model', 'Vertical service chamber', 'Open armor silhouette around model', 'Interior seams and selective rim reveal plate thickness', 'Check plate overlap, model clearance and original materials when supplied'],
  seraph: ['Six articulated celestial wings', 'Near wing blades', 'Wing roots and halo', 'Monumental cathedral', 'Six wings remain readable against architecture', 'Warm metal and core emission separate wing layers', 'Retain wing tips and meaningful halo articulation'],
  paradox: ['Interwoven mathematical ribbon trusses', 'Near ribbon cross sections', 'Nested rotating loops', 'Faceted optical chamber', 'Distinct nested loops, not a merged mass', 'Cool metal and strand emission separate interwoven paths', 'Inspect occlusion and layer separation during rotation'],
  relic: ['Mechanical skull and hinged jaw', 'Jaw and containment arcs', 'Cranial plates and eye sockets', 'Containment chamber', 'Readable skull, jaw and socket silhouette', 'Socket borders and core accent reveal skull volume', 'Check jaw and fragments through motion; retain skull recognition'],
  monolith: ['Branching radial alien intelligence', 'Near tendrils and blade edges', 'Radial branches and core cage', 'Monumental room', 'Coherent radial truss silhouette', 'Sequential branch accents preserve structural depth', 'Check tendril tips and core during deployment'],
  honey: ['Beveled industrial honeycomb wall', 'Near plate bevels', 'Hex plates and recessed chambers', 'Substrate and cavity depth', 'Legible hex tiling with deliberate open cavities', 'Local emissions and shadows reveal bevels and recesses', 'Close framing may crop repeating tiles intentionally; avoid clipping focal cavity'],
})
export const criteria = ['subjectLegibility','negativeSpace','depthParallax','selectiveLighting','patternDistinction','mediaFidelity','noClipping']
export const checkpoints = Object.freeze([
  ['reference',1], ['idle',15], ['idle',30], ['build',1], ['build',29], ['build',30],
  ['drop',1], ['drop',14], ['drop',15], ['drop',30], ['breakdown',1], ['breakdown',29], ['breakdown',30],
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
  return Object.fromEntries(criteria.map(key => [key, { status: 'pending', evidence: '', reason: '' }]))
}
export function comparable(a, b) {
  return Boolean(a.inventory && b.inventory) && JSON.stringify(a.config) === JSON.stringify(b.config) &&
    a.inventory.id === b.inventory.id && JSON.stringify(JSON.parse(a.inventory.parameters).values) === JSON.stringify(JSON.parse(b.inventory.parameters).values) &&
    JSON.stringify(a.inventory.metadata) === JSON.stringify(b.inventory.metadata) &&
    JSON.stringify(a.frames.map(f => f.name)) === JSON.stringify(b.frames.map(f => f.name))
}
export function validateApproval(review, baseline, candidate) {
  if (!comparable(baseline, candidate)) throw Error('Capture configurations or authored settings differ')
  if (review.baselineHash !== baseline.hash || review.candidateHash !== candidate.hash) throw Error('Approval is not bound to these capture records')
  if (!review.reviewer?.trim() || !review.approvedAt || !Number.isFinite(Date.parse(review.approvedAt)) || review.decision !== 'approved') throw Error('Explicit dated human approval required')
  if (!baseline.complete || !candidate.complete || candidate.errors.length || candidate.frames.some(f => f.failed)) throw Error('Incomplete or failed candidate captures')
  for (const key of criteria) {
    const item = review.rubric?.[key]
    if (!item || !['pass','not-applicable'].includes(item.status) || !item.evidence?.trim() || !item.reason?.trim()) throw Error(`Unresolved criterion: ${key}`)
    if (item.status === 'not-applicable' && key !== 'mediaFidelity') throw Error(`Cannot waive ${key}`)
  }
  const frame = candidate.frames.find(f => f.name === review.thumbnailFrame)
  if (!frame || frame.failed || frame.pixels.uniform) throw Error('Select a nonblank candidate frame')
  return frame
}
