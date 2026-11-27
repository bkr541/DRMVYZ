import { inventory, binary, sha256, root, policy, assetIssues, extension } from './development-assets.mjs'
const args = process.argv.slice(2)
if (args.some(a => a !== '--check' && a !== '--json')) throw new Error('Usage: npm run audit:assets -- [--check] [--json]')
const entries = inventory(root,{includeNew:false}), groups = new Map(), categories = {}, extensions = {}, directories = {}
function add(bucket,key,size) { const v = bucket[key] ??= {files:0,bytes:0}; v.files++;v.bytes+=size }
for (const e of entries) {
  add(categories,e.category,e.size);add(extensions,extension(e.path),e.size);add(directories,e.path.split('/')[0],e.size)
  if (!binary.test(e.path) || e.category==='private/generated' || e.excluded) continue
  const hash = sha256(root,e.path); const group = groups.get(hash) ?? [];group.push({path:e.path,size:e.size});groups.set(hash,group)
}
const duplicates = [...groups].filter(([,files])=>files.length>1).map(([sha256,files])=>({sha256,files,redundantBytes:files[0].size*(files.length-1)})).sort((a,b)=>b.redundantBytes-a.redundantBytes)
const {issues,total,overBudget} = assetIssues(entries)
const result = {totalBytes:total,budgetMiB:policy.repositoryBudgetMiB,overBudget,categories,extensions,directories,largest:entries.filter(e=>binary.test(e.path)).sort((a,b)=>b.size-a.size).slice(0,25),duplicates,issues,retainedLegacyAssets:policy.retainedLegacyAssets}
if (args.includes('--json')) console.log(JSON.stringify(result,null,2))
else {
  console.log(`Tracked working-tree content: ${(total/1048576).toFixed(2)} MiB / ${policy.repositoryBudgetMiB} MiB budget`)
  console.table(categories); console.table(result.largest.map(({path,size,category})=>({path,MiB:(size/1048576).toFixed(2),category})))
  for (const g of duplicates) console.log(`Duplicate candidate (${g.redundantBytes} bytes): ${g.files.map(f=>f.path).join(' | ')}`)
  for (const e of issues) console.error(`Review ${e.path}: ${e.category}; move temporary evidence to artifacts/ or document a justified policy exception.`)
  console.log(`${issues.length} policy violations; ${duplicates.length} duplicate candidate groups (review before deleting).`)
}
if (args.includes('--check') && (overBudget || issues.length)) process.exitCode=1
