import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { inflateRawSync, crc32 } from 'node:zlib'
import { inventory, select, assetIssues, privateOrGenerated } from './development-assets.mjs'
import { writeZip } from './export-development.mjs'
import { optionalSourceDirectory, requiredSource } from './cinema2-assets/optional-source.mjs'

test('working-tree selection preserves tracked edits and safe new source, but excludes private/generated and unstaged binary files', t => {
  const cwd = mkdtempSync(resolve(tmpdir(),'stageless-export-')); t.after(()=>rmSync(cwd,{recursive:true,force:true}))
  const git = (...args)=>execFileSync('git',args,{cwd,stdio:'ignore'})
  const put = (name,value)=>{mkdirSync(resolve(cwd,name,'..'),{recursive:true});writeFileSync(resolve(cwd,name),value)}
  git('init','-q'); put('src/a.ts','initial'); put('native/output/cast.cjs','runtime'); put('public/model.glb',Buffer.alloc(300000));put('docs/old.png','image');put('asset-sources/original.glb','unique');put('.env.example','example');put('.gitignore','artifacts/\n');git('add','-A')
  put('src/a.ts','changed');put('src/new.ts','new');put('src/private.key','secret');put('src/random.png','unstaged asset');put('notes.txt','unrelated');put('artifacts/old.zip','ignored');put('.env','private')
  const entries=inventory(cwd), standard=entries.filter(e=>select(e)).map(e=>e.path)
  assert.deepEqual(standard,['.env.example','.gitignore','native/output/cast.cjs','public/model.glb','src/a.ts','src/new.ts'])
  assert.equal(readFileSync(resolve(cwd,'src/a.ts'),'utf8'),'changed')
  assert.ok(entries.filter(e=>select(e,'full-assets')).some(e=>e.path==='docs/old.png'))
  assert.ok(!entries.filter(e=>select(e,'source-only')).some(e=>e.path==='public/model.glb'))
  assert.deepEqual(assetIssues(entries,{retainedLegacyAssets:[],repositoryBudgetMiB:1}).issues.map(e=>e.path),['asset-sources/original.glb','docs/old.png'])
  assert.ok(privateOrGenerated('supabase/.temp/project-ref'));assert.ok(!privateOrGenerated('public/model.glb'));assert.ok(!privateOrGenerated('native/output/cast.cjs'));assert.ok(privateOrGenerated('output/temp.png'))
})
test('ZIP entries are deterministic and preserve UTF-8 paths, bytes and checksums',t=>{
  const cwd=mkdtempSync(resolve(tmpdir(),'stageless-zip-'));t.after(()=>rmSync(cwd,{recursive:true,force:true}))
  const payload=Buffer.from('working tree contents'); const entries=[{path:'src/é.ts',read:()=>payload}]
  const a=resolve(cwd,'a.zip'),b=resolve(cwd,'b.zip');writeZip(a,entries);writeZip(b,entries)
  const bytes=readFileSync(a);assert.deepEqual(bytes,readFileSync(b));assert.equal(bytes.readUInt32LE(0),0x04034b50)
  const length=bytes.readUInt16LE(26);assert.equal(bytes.subarray(30,30+length).toString(),'src/é.ts');assert.equal(bytes.readUInt32LE(14),crc32(payload));assert.deepEqual(inflateRawSync(bytes.subarray(30+length,30+length+bytes.readUInt32LE(18))),payload)
})
test('optional model source lookup has clear missing-file guidance and respects external root',t=>{
  const cwd=mkdtempSync(resolve(tmpdir(),'stageless-source-'));t.after(()=>rmSync(cwd,{recursive:true,force:true}))
  const previous=process.env.STAGELESS_SOURCE_ASSETS;t.after(()=>{if(previous===undefined)delete process.env.STAGELESS_SOURCE_ASSETS;else process.env.STAGELESS_SOURCE_ASSETS=previous})
  delete process.env.STAGELESS_SOURCE_ASSETS;assert.equal(optionalSourceDirectory(cwd,'vacancy','asset-sources/vacancy'),resolve(cwd,'asset-sources/vacancy'))
  process.env.STAGELESS_SOURCE_ASSETS=cwd;const dir=optionalSourceDirectory('unused','vacancy','unused');assert.equal(dir,resolve(cwd,'vacancy'));assert.throws(()=>requiredSource(dir,'model.glb'),/STAGELESS_SOURCE_ASSETS/);mkdirSync(dir);writeFileSync(resolve(dir,'model.glb'),'model');assert.equal(requiredSource(dir,'model.glb'),resolve(dir,'model.glb'))
})
