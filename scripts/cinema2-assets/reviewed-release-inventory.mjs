// QA-02: explicit prompt-derived scope, not a transcription of the unavailable review recording.
export const inventoryVersion = 'reviewed-v1'
const original = ['colossus','exoskeleton','seraph','paradox','relic','monolith','honey','spectrum','corridor','everywhere','fracture','refraction','mosaic','overdrive','hud','purity','livewire','crate-wireframe-portal','allstar']
export const reviewedEntries = Object.freeze([...original,'chamber','monument'].map(key=>Object.freeze({key,id:`drmvyz.cinema2.${key}`})))
// Independent minimum contract prevents accidental edits to the entry list itself.
const requiredKeys = 'colossus exoskeleton seraph paradox relic monolith honey spectrum corridor everywhere fracture refraction mosaic overdrive hud purity livewire crate-wireframe-portal allstar chamber monument'.split(' ')
export const inventory = Object.freeze(reviewedEntries.map(e=>e.key))
export const equalSet=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&new Set(a).size===a.length&&new Set(b).size===b.length&&a.length===b.length&&a.every(k=>b.includes(k))
export function validateInventory(entries=reviewedEntries, compiled) {
  if(!equalSet(entries.map(e=>e.key),requiredKeys)||!equalSet(entries.map(e=>e.id),reviewedEntries.map(e=>e.id))||entries.some(e=>reviewedEntries.find(x=>x.key===e.key)?.id!==e.id))throw Error('Reviewed inventory missing, duplicate, unknown or mismapped key/ID')
  if(compiled&&(!equalSet(compiled.map(m=>m.id),entries.map(e=>e.id))||compiled.some(m=>!m.active||!m.compiled)))throw Error('Reviewed inventory contains unresolved or inactive compiled IDs')
}
export function inventoryCoverage(requested,subsetRequested=false) {
  validateInventory()
  if(!Array.isArray(requested)||!requested.length||new Set(requested).size!==requested.length||requested.some(k=>!inventory.includes(k)))throw Error('Unknown or duplicate preset')
  const absent=inventory.filter(k=>!requested.includes(k)),fullInventory=equalSet(requested,inventory)
  return {inventoryVersion,expectedInventory:[...inventory],requestedInventory:[...requested],expectedIds:reviewedEntries.map(e=>e.id),requestedIds:requested.map(k=>reviewedEntries.find(e=>e.key===k).id),absentEntries:absent,coveragePercentage:100*requested.length/inventory.length,fullInventory,subsetRequested,scope:subsetRequested||!fullInventory?'subset-only':'full-inventory'}
}
export function coverageValid(report) {
  try {const expected=inventoryCoverage(report.inventory,report.subsetRequested===true);validateInventory(reviewedEntries,report.registry??[]);return Object.keys(expected).every(k=>JSON.stringify(report[k])===JSON.stringify(expected[k]))&& (expected.fullInventory||expected.subsetRequested)&&equalSet(Object.keys(report.presets),report.inventory)}catch{return false}
}
// Compiled manifest facts, not display-name heuristics. Media formats beyond the
// image fixture are tracked separately; absent evidence is not a format pass.
export function capabilityPlan(meta) {
  const controls=meta.controls??[],modules=meta.modules??[],slots=meta.mediaSlots??[]
  const model=controls.find(p=>p.metadata?.editor==='user-model-selector')
  const modelModules=modules.filter(m=>model&&m.parameterBindings?.userModel?.$ref===model.id)
  const modelBound=modelModules.length>0
  const presentation=controls.find(p=>p.label==='Model Presentation')
  const cameraRefs=(meta.cameras??[]).map(c=>c.controls??{})
  const controlFor=ref=>controls.find(p=>p.id===ref?.$ref)
  const cameraMode=cameraRefs.map(c=>controlFor(c.rigMode)).find(p=>p?.options?.some(o=>o.value==='home')&&p.options.some(o=>o.value==='drift'))
  const cameraPermission=cameraRefs.map(c=>controlFor(c.motionEnabled)).find(p=>p?.type==='boolean')
  const content=controls.find(p=>modules.some(m=>m.parameterBindings?.['content-type']?.$ref===p.id)&&p.options?.some(o=>o.value==='text')&&p.options.some(o=>o.value==='model'))
  return {fixedAssets:modules.flatMap(m=>Array.isArray(m.config?.instances)?m.config.instances.map(x=>x.asset):[]),media:Object.fromEntries(['image','video','svg'].map(kind=>[kind,slots.filter(s=>s.accepts.includes(kind)).map(s=>({id:s.id,required:s.required===true}))])),model:model?{id:model.id,bound:modelBound,sourcePolicy:modelModules.some(m=>m.config?.userModelPreview)?'representation-preview': 'optional-replacement',moduleTypes:modelModules.map(m=>m.typeId),presentationModes:presentation?.options?.map(o=>o.value)??[],contentMode:content?.id??null,fixedAssets:modules.flatMap(m=>Array.isArray(m.config?.instances)?m.config.instances.map(x=>x.asset):[])}:null,camera:{permission:cameraPermission?.id??null,mode:cameraMode?.id??null},patternTriggers:controls.find(p=>p.label==='Trigger')?.options?.map(o=>o.value)??[]}
}
