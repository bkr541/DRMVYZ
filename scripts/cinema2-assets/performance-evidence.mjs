// QA-07: wall-clock delivery evidence is independent of pixel captures and CPU estimates.
const finite = n => Number.isFinite(n) && n >= 0
export function percentiles(values) {
  if (!values.length || !values.every(finite)) return null
  const sorted = [...values].sort((a,b)=>a-b)
  const p = q => sorted[Math.ceil(q*sorted.length)-1]
  return { count: sorted.length, p50: p(.5), p95: p(.95), p99: p(.99) }
}
export function summarizePlayback(raw, refreshHz) {
  const intervals = percentiles(raw.intervals), cpu = percentiles(raw.cpu), gpu = percentiles(raw.gpu)
  const issues = []
  if (!intervals || raw.intervals.some(n=>n<=0) || raw.measuredFrames !== raw.intervals.length || !finite(raw.elapsedMs) || raw.elapsedMs<=0 || Math.abs(raw.intervals.reduce((a,b)=>a+b,0)-raw.elapsedMs)>1 || raw.finalSnapshot.frameCount-raw.startSnapshot.frameCount!==raw.measuredFrames) issues.push('Invalid frame delivery evidence')
  if (!cpu || cpu.count!==raw.measuredFrames) issues.push('Missing CPU callback observations')
  if (raw.glError!==0) issues.push('GL error after playback')
  const budgetMs = finite(refreshHz)&&refreshHz>0 ? 1000/refreshHz : null
  const gpuStatus = !raw.gpuSupported ? 'unsupported' : raw.disjointCount>0 ? 'disjoint' : !gpu ? 'unavailable' : 'measured'
  return { status: issues.length?'fail':'pass', issues, deliveredFps: intervals&&raw.elapsedMs>0 ? raw.measuredFrames*1000/raw.elapsedMs : null,
    measuredFrames: raw.measuredFrames, elapsedMs:raw.elapsedMs, intervals, cpu, gpu:gpuStatus==='measured'?gpu:null, gpuStatus, disjointCount:raw.disjointCount,
    targetRefreshHz:budgetMs?refreshHz:null, budgetMs,
    estimatedMissedRefreshes:budgetMs&&intervals?raw.intervals.reduce((sum,ms)=>sum+Math.max(0,Math.round(ms/budgetMs)-1),0):null }
}
export function ownershipIssues(snapshot, retired=false) {
  const issues=[], o=snapshot.owners, r=snapshot.resources, m=snapshot.modules
  const want=retired?0:1
  for(const [field,value] of Object.entries({activeRuntimeCount:want,activeTargetResolverCount:want,activeWebGLContextCount:want,activeAnimationFrameCount:want,activeEventListenerCount:want*2})) if(o?.[field]!==value)issues.push(`Unexpected ${field}: ${o?.[field]}`)
  if(retired && (r.activeLeaseCount!==0||r.estimatedGpuMemoryBytes!==0||m.activeResourceLeaseCount!==0||m.estimatedGpuBytes!==0||snapshot.modelCache?.heldCount!==0))issues.push('Retired runtime retained resources')
  if(!retired && (r.pooledAllocationCount>r.maximumPooledAllocationCount||r.estimatedGpuMemoryBytes>r.maximumEstimatedGpuMemoryBytes))issues.push('Render target pool exceeded its configured bound')
  return issues
}
// Compare warmed identical-preset snapshots, not unrelated presets or a cold cache.
export function steadyStateIssues(samples) {
  if(samples.length<2)return ['Insufficient steady-state snapshots']
  const issues=samples.flatMap(s=>ownershipIssues(s))
  const first=samples[0], last=samples.at(-1)
  for(const [name,read] of Object.entries({targetLeases:s=>s.resources.activeLeaseCount,moduleLeases:s=>s.modules.activeResourceLeaseCount,modelHolders:s=>s.modelCache.heldCount})) if(read(last)>read(first))issues.push(`${name} increased after warmup`)
  const bytes=s=>s.resources.estimatedGpuMemoryBytes+s.modules.estimatedGpuBytes
  if(bytes(last)>bytes(first)*1.25+4*1024*1024)issues.push('Estimated allocation grew beyond steady-state tripwire')
  return issues
}
export function rendererClass(renderer='') {
  if(!renderer||/unknown|unavailable/i.test(renderer))return 'unknown'
  if(/swiftshader|llvmpipe|softpipe|software|basic render|lavapipe/i.test(renderer))return 'software'
  return /apple|nvidia|amd|radeon|intel|adreno|mali|geforce|arc\b/i.test(renderer)?'hardware-reported':'unknown'
}
export function comparePlayback(before,after) {
  const required=['platform','osRelease','arch','cpu','browser','renderer','rendererClass','display','refreshHz','dpr','fixtureHash','driver','capture','config','screen','headless','allowSoftware']
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
  if(required.some(k=>before.environment?.[k]==null||after.environment?.[k]==null||!same(before.environment[k],after.environment[k]))||before.environment.rendererClass!=='hardware-reported'||before.environment.headless!==false||!before.revision||!after.revision||!same(Object.keys(before.scenarios??{}).sort(),Object.keys(after.scenarios??{}).sort()))return {status:'incomplete',issues:['Incomparable or unknown hardware, driver, display, fixture, settings or scenario matrix']}
  const issues=[], missing=[]
  for(const [key,b] of Object.entries(after.scenarios)) {
    const a=before.scenarios[key]
    if(a?.status!=='pass'||b.status!=='pass'||!same(a.settings,b.settings)||a.gpuStatus!=='measured'||b.gpuStatus!=='measured'||![a.cpu?.p95,b.cpu?.p95,a.gpu?.p95,b.gpu?.p95,a.deliveredFps,b.deliveredFps,a.gpuBytes,b.gpuBytes].every(finite)){missing.push(`${key}: incomplete or incompatible measurements`);continue}
    if(b.cpu.p95>a.cpu.p95*1.5+2)issues.push(`${key}: CPU p95 regression`)
    if(b.gpu.p95>a.gpu.p95*1.5+2)issues.push(`${key}: GPU p95 regression`)
    if(b.gpuBytes>a.gpuBytes*1.25+4*1024*1024)issues.push(`${key}: estimated allocation regression`)
    if(b.deliveredFps<a.deliveredFps*.85)issues.push(`${key}: delivery FPS regression (>15% relative diagnostic tripwire)`)
  }
  if(!Object.keys(after.scenarios).length)missing.push('No measured scenarios')
  return {status:issues.length?'fail':missing.length?'incomplete':'pass',issues:[...issues,...missing]}
}
