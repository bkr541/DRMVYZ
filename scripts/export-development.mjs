import { createHash } from 'node:crypto'
import { closeSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from 'node:fs'
import { resolve } from 'node:path'
import { crc32, deflateRawSync } from 'node:zlib'
import { binary, inventory, policy, root, select } from './development-assets.mjs'

// ZIP32, UTF-8, fixed DOS epoch and sorted paths. No external executable or npm dependency.
// Stream entries to disk; only a single file and its compressed data are held in memory.
export function writeZip(output, entries) {
  if (entries.length > 65535) throw new Error('ZIP32 entry count exceeded')
  const fd = openSync(output, 'wx'); const central = []; let offset = 0
  function write(bytes) {
    if (offset + bytes.length > 0xffffffff) throw new Error('ZIP32 size exceeded')
    let done = 0; while (done < bytes.length) { const n = writeSync(fd, bytes, done, bytes.length-done); if (!n) throw new Error('Short ZIP write'); done += n }
    offset += bytes.length
  }
  try {
    for (const entry of entries) {
      const name = Buffer.from(entry.path, 'utf8'), data = entry.read()
      if (name.length > 65535 || data.length > 0xffffffff) throw new Error(`ZIP32 entry too large: ${entry.path}`)
      const packed = deflateRawSync(data, { level: 6 }), crc = crc32(data), start = offset
      const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50); h.writeUInt16LE(20,4); h.writeUInt16LE(0x800,6); h.writeUInt16LE(8,8); h.writeUInt16LE(33,12); h.writeUInt32LE(crc,14); h.writeUInt32LE(packed.length,18); h.writeUInt32LE(data.length,22); h.writeUInt16LE(name.length,26)
      write(h); write(name); write(packed)
      const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50); c.writeUInt16LE(0x314,4); c.writeUInt16LE(20,6); c.writeUInt16LE(0x800,8); c.writeUInt16LE(8,10); c.writeUInt16LE(33,14); c.writeUInt32LE(crc,16); c.writeUInt32LE(packed.length,20); c.writeUInt32LE(data.length,24); c.writeUInt16LE(name.length,28); c.writeUInt32LE((entry.path.endsWith('.command') || entry.path.endsWith('.sh') ? 0o100755 : 0o100644) * 65536,38); c.writeUInt32LE(start,42)
      central.push(c,name)
    }
    const start = offset; for (const c of central) write(c)
    const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length,8); end.writeUInt16LE(entries.length,10); end.writeUInt32LE(offset-start,12); end.writeUInt32LE(start,16); write(end)
    return offset
  } finally { closeSync(fd) }
}
function main() {
  const args = process.argv.slice(2)
  if (args.some(a => !['--source-only','--full-assets','--dry-run'].includes(a)) || (args.includes('--source-only') && args.includes('--full-assets'))) throw new Error('Usage: npm run export:development -- [--source-only | --full-assets] [--dry-run]')
  const mode = args.includes('--source-only') ? 'source-only' : args.includes('--full-assets') ? 'full-assets' : 'standard'
  const entries = inventory(), included = entries.filter(e => select(e,mode)), excluded = entries.filter(e => !select(e,mode))
  const totals = Object.create(null)
  for (const e of excluded) { const key = e.excluded ? 'unapproved/untracked' : e.category; const n = totals[key] ??= {files:0,bytes:0}; n.files++; n.bytes += e.size }
  const mib = n => (n/1048576).toFixed(2)+' MiB'
  console.log(`${mode}: ${included.length} files, ${mib(included.reduce((n,e)=>n+e.size,0))} uncompressed; excluded ${excluded.length} files (${mib(excluded.reduce((n,e)=>n+e.size,0))}). Ignored untracked files are not enumerated.`)
  console.table(totals)
  if (args.includes('--dry-run')) return
  const budget = Number(process.env.STAGELESS_EXPORT_BUDGET_MIB ?? policy.exportBudgetMiB)
  if (!Number.isFinite(budget) || budget <= 0) throw new Error('Invalid export budget')
  const omitted = excluded.filter(e => !e.excluded && e.category !== 'private/generated' && binary.test(e.path)).map(e => ({ path:e.path, size:e.size, category:e.category, sha256:createHash('sha256').update(readFileSync(resolve(root,e.path))).digest('hex') }))
  const manifestPath = 'DEVELOPMENT-EXPORT-INVENTORY.json'
  if (included.some(e => e.path === manifestPath)) throw new Error(`Reserved archive path: ${manifestPath}`)
  const manifest = Buffer.from(JSON.stringify({ mode, runnable:mode !== 'source-only', omittedAssets:omitted },null,2)+'\n')
  const archiveEntries = [...included.map(e => ({path:e.path,read:()=>readFileSync(resolve(root,e.path))})), {path:manifestPath,read:()=>manifest}].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)
  const dir = resolve(root,'artifacts/development-export'); mkdirSync(dir,{recursive:true})
  const output = resolve(dir,`STAGELESS-Studio-Development${mode==='standard'?'':`-${mode}`}.zip`), temp = `${output}.${process.pid}.tmp`
  let size
  try { size = writeZip(temp,archiveEntries); renameSync(temp,output) } finally { rmSync(temp,{force:true}) }
  console.log(`${output}\nZIP size: ${mib(size)} (budget ${budget} MiB)`)
  if (size > budget*1048576) console.warn('WARNING: development ZIP exceeds configured budget; consider --source-only.')
}
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) main()
