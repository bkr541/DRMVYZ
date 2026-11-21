'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { applyStagelessProfile, migrateDataDirectory, MIGRATION_MARKER, OLD_FOLDER_NOTE } = require('./userDataMigration.cjs')

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'userdata-migration-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const oldDir = path.join(root, 'OLD')
  const newDir = path.join(root, 'NEW')
  fs.mkdirSync(path.join(oldDir, 'Local Storage', 'leveldb'), { recursive: true })
  fs.writeFileSync(path.join(oldDir, 'Local Storage', 'leveldb', '000003.log'), 'session')
  fs.writeFileSync(path.join(oldDir, 'receiver-identity.json'), '{"id":"abc"}')
  return { root, oldDir, newDir }
}

const readTree = dir => fs.readFileSync(path.join(dir, 'Local Storage', 'leveldb', '000003.log'), 'utf8')

test('only the old folder exists: it is moved and marked', t => {
  const { oldDir, newDir } = fixture(t)
  const result = migrateDataDirectory({ oldDir, newDir })
  assert.deepEqual({ dir: result.dir, status: result.status }, { dir: newDir, status: 'moved' })
  assert.equal(readTree(newDir), 'session')
  assert.ok(fs.existsSync(path.join(newDir, MIGRATION_MARKER)))
  assert.equal(fs.existsSync(oldDir), false)
})

test('no old folder: nothing happens', t => {
  const { root } = fixture(t)
  const result = migrateDataDirectory({ oldDir: path.join(root, 'missing'), newDir: path.join(root, 'NEW') })
  assert.equal(result.status, 'no-old')
  assert.equal(fs.existsSync(path.join(root, 'NEW')), false)
})

test('both folders exist and the new one carries the marker: untouched', t => {
  const { oldDir, newDir } = fixture(t)
  fs.mkdirSync(newDir)
  fs.writeFileSync(path.join(newDir, MIGRATION_MARKER), 'x')
  fs.writeFileSync(path.join(newDir, 'keep.txt'), 'new data')
  const result = migrateDataDirectory({ oldDir, newDir })
  assert.equal(result.status, 'already-migrated')
  assert.equal(fs.readFileSync(path.join(newDir, 'keep.txt'), 'utf8'), 'new data')
  assert.equal(readTree(oldDir), 'session')
})

test('a populated new folder without the marker is never merged or overwritten', t => {
  const { oldDir, newDir } = fixture(t)
  fs.mkdirSync(newDir)
  fs.writeFileSync(path.join(newDir, 'other.txt'), 'someone else')
  const result = migrateDataDirectory({ oldDir, newDir })
  assert.equal(result.status, 'skipped-new-has-data')
  assert.equal(fs.readFileSync(path.join(newDir, 'other.txt'), 'utf8'), 'someone else')
  assert.equal(readTree(oldDir), 'session')
})

test('an existing but empty new folder is replaced by the migration', t => {
  const { oldDir, newDir } = fixture(t)
  fs.mkdirSync(newDir)
  const result = migrateDataDirectory({ oldDir, newDir })
  assert.equal(result.status, 'moved')
  assert.equal(readTree(newDir), 'session')
})

test('rename failure falls back to a copy, keeps the old folder and leaves a note', t => {
  const { oldDir, newDir, root } = fixture(t)
  const failingFs = { ...fs, renameSync: (from, to) => { if (from === oldDir) throw Object.assign(new Error('EXDEV'), { code: 'EXDEV' }); return fs.renameSync(from, to) } }
  const result = migrateDataDirectory({ oldDir, newDir, fs: failingFs })
  assert.equal(result.status, 'copied')
  assert.equal(readTree(newDir), 'session')
  assert.equal(readTree(oldDir), 'session')
  assert.ok(fs.existsSync(path.join(oldDir, OLD_FOLDER_NOTE)))
  assert.ok(fs.existsSync(path.join(newDir, MIGRATION_MARKER)))
  assert.deepEqual(fs.readdirSync(root).filter(name => name.includes('.migrating-')), [])
})

test('copy failure falls back to the old folder and removes no data', t => {
  const { oldDir, newDir, root } = fixture(t)
  const failingFs = {
    ...fs,
    renameSync: (from, to) => { if (from === oldDir) throw new Error('EXDEV'); return fs.renameSync(from, to) },
    cpSync: () => { throw new Error('ENOSPC') },
  }
  const result = migrateDataDirectory({ oldDir, newDir, fs: failingFs })
  assert.equal(result.status, 'failed')
  assert.equal(result.dir, oldDir)
  assert.match(result.error.message, /ENOSPC/)
  assert.equal(readTree(oldDir), 'session')
  assert.equal(fs.existsSync(newDir), false)
  assert.deepEqual(fs.readdirSync(root).filter(name => name.includes('.migrating-')), [])
})

test('running the migration twice is idempotent', t => {
  const { oldDir, newDir } = fixture(t)
  assert.equal(migrateDataDirectory({ oldDir, newDir }).status, 'moved')
  assert.equal(migrateDataDirectory({ oldDir, newDir }).status, 'no-old')
  const failingFs = { ...fs, renameSync: (from, to) => { if (from === oldDir) throw new Error('EXDEV'); return fs.renameSync(from, to) } }
  fs.rmSync(newDir, { recursive: true })
  fs.mkdirSync(path.join(oldDir, 'x'), { recursive: true })
  assert.equal(migrateDataDirectory({ oldDir, newDir, fs: failingFs }).status, 'copied')
  assert.equal(migrateDataDirectory({ oldDir, newDir, fs: failingFs }).status, 'already-migrated')
})

test('applyStagelessProfile points userData at the new folder (packaged) and the dev profile', t => {
  const { root } = fixture(t)
  const appData = path.join(root, 'appData')
  fs.mkdirSync(path.join(appData, 'DRMVYZ'), { recursive: true })
  fs.writeFileSync(path.join(appData, 'DRMVYZ', 'settings.json'), '{}')
  fs.mkdirSync(path.join(appData, 'DRMVYZ Development'), { recursive: true })
  fs.writeFileSync(path.join(appData, 'DRMVYZ Development', 'dev.json'), '{}')
  const make = () => {
    const paths = {}
    return { paths, app: { getPath: name => ({ appData, home: root })[name], setPath: (name, value) => { paths[name] = value }, setAppLogsPath: value => { paths.logs = value } } }
  }

  const packaged = make()
  const packagedResults = applyStagelessProfile({ app: packaged.app, brandName: 'STAGELESS', isDevelopment: false, platform: 'linux' })
  assert.equal(packaged.paths.userData, path.join(appData, 'STAGELESS'))
  assert.equal(packagedResults[0].status, 'moved')
  assert.ok(fs.existsSync(path.join(appData, 'STAGELESS', 'settings.json')))

  const dev = make()
  applyStagelessProfile({ app: dev.app, brandName: 'STAGELESS', isDevelopment: true, platform: 'linux' })
  assert.equal(dev.paths.userData, path.join(appData, 'STAGELESS Development'))
  assert.ok(fs.existsSync(path.join(appData, 'STAGELESS Development', 'dev.json')))
})

test('on macOS packaged builds the log folder moves too and failures never block startup', t => {
  const { root } = fixture(t)
  const appData = path.join(root, 'appData')
  fs.mkdirSync(appData, { recursive: true })
  fs.mkdirSync(path.join(root, 'Library', 'Logs', 'DRMVYZ'), { recursive: true })
  fs.writeFileSync(path.join(root, 'Library', 'Logs', 'DRMVYZ', 'main.log'), 'log')
  const paths = {}
  const app = { getPath: name => ({ appData, home: root })[name], setPath: (n, v) => { paths[n] = v }, setAppLogsPath: v => { paths.logs = v } }
  const results = applyStagelessProfile({ app, brandName: 'STAGELESS', isDevelopment: false, platform: 'darwin' })
  assert.equal(paths.logs, path.join(root, 'Library', 'Logs', 'STAGELESS'))
  assert.equal(results.find(entry => entry.scope === 'logs').status, 'moved')
  assert.equal(fs.readFileSync(path.join(paths.logs, 'main.log'), 'utf8'), 'log')
})
