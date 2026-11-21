'use strict'

// One-time move of the application data folder from the legacy product name to
// STAGELESS (docs/stageless-rename.md, section 5). Electron derives userData and
// logs from the product name, so renaming the product would otherwise start the
// app with an empty profile (sign-in, settings, saved favorites, receiver
// pairing, Rekordbox indexes).
//
// Guarantees: data is never deleted by a failed attempt; a copy never removes
// the old folder; the new folder only ever appears complete (copies go to a
// temporary sibling first); the result is idempotent via a marker file.

const nodeFs = require('node:fs')
const path = require('node:path')

const LEGACY_APP_NAME = 'DRMVYZ'
const LEGACY_DEV_PROFILE_NAME = `${LEGACY_APP_NAME} Development`
const MIGRATION_MARKER = '.migration-v1'
const OLD_FOLDER_NOTE = 'migrated-to-STAGELESS.txt'

function isDirectory(fs, target) {
  try { return fs.statSync(target).isDirectory() } catch { return false }
}

function isEmptyDirectory(fs, target) {
  try { return fs.readdirSync(target).length === 0 } catch { return false }
}

function hasMarker(fs, dir) {
  try { return fs.existsSync(path.join(dir, MIGRATION_MARKER)) } catch { return false }
}

function removeQuietly(fs, target) {
  try { fs.rmSync(target, { recursive: true, force: true }) } catch { /* best effort */ }
}

/**
 * Move `oldDir` to `newDir`.
 * Returns { dir, status, error? }. `dir` is the folder the app must use:
 * `newDir` in every case except `failed`, where it is `oldDir` so no data is lost.
 * Statuses: no-old | already-migrated | moved | copied | skipped-new-has-data | failed
 */
function migrateDataDirectory({ oldDir, newDir, fs = nodeFs, pid = process.pid }) {
  if (!isDirectory(fs, oldDir)) return { dir: newDir, status: 'no-old' }
  if (hasMarker(fs, newDir)) return { dir: newDir, status: 'already-migrated' }
  // A populated new folder without a marker was created by something else.
  // Never merge or overwrite it; keep the old folder untouched.
  if (isDirectory(fs, newDir) && !isEmptyDirectory(fs, newDir)) return { dir: newDir, status: 'skipped-new-has-data' }

  try {
    fs.mkdirSync(path.dirname(newDir), { recursive: true })
    if (isDirectory(fs, newDir)) fs.rmdirSync(newDir) // empty: let rename replace it (required on Windows)
    fs.renameSync(oldDir, newDir)
    fs.writeFileSync(path.join(newDir, MIGRATION_MARKER), `moved from ${path.basename(oldDir)}\n`)
    return { dir: newDir, status: 'moved' }
  } catch (renameError) {
    // Cross-device, locked, or permission problem: fall back to a copy.
    // Another instance may have won the race while we were deciding.
    if (hasMarker(fs, newDir)) return { dir: newDir, status: 'already-migrated' }
    const staging = `${newDir}.migrating-${pid}`
    try {
      removeQuietly(fs, staging)
      fs.cpSync(oldDir, staging, { recursive: true })
      fs.writeFileSync(path.join(staging, MIGRATION_MARKER), `copied from ${path.basename(oldDir)}\n`)
      fs.renameSync(staging, newDir)
    } catch (copyError) {
      removeQuietly(fs, staging)
      if (hasMarker(fs, newDir)) return { dir: newDir, status: 'already-migrated' }
      return { dir: oldDir, status: 'failed', error: copyError instanceof Error ? copyError : renameError }
    }
    try {
      fs.writeFileSync(path.join(oldDir, OLD_FOLDER_NOTE), `This folder was copied to ${newDir}.\nIt is no longer used and can be deleted once you have confirmed STAGELESS works.\n`)
    } catch { /* the old folder may be read-only; the copy already succeeded */ }
    return { dir: newDir, status: 'copied' }
  }
}

/**
 * Compute and apply the STAGELESS data/log locations, migrating legacy folders.
 * Must run before `app.whenReady()`. Returns a list of {scope, status, error?}
 * entries for the caller to log (logging is not loaded yet at that point).
 */
function applyStagelessProfile({ app, brandName, isDevelopment, fs = nodeFs, platform = process.platform }) {
  const results = []
  const appData = app.getPath('appData')
  const newName = isDevelopment ? `${brandName} Development` : brandName
  const oldName = isDevelopment ? LEGACY_DEV_PROFILE_NAME : LEGACY_APP_NAME

  const data = migrateDataDirectory({ oldDir: path.join(appData, oldName), newDir: path.join(appData, newName), fs })
  results.push({ scope: 'userData', ...data })
  app.setPath('userData', data.dir)

  // macOS keeps logs in ~/Library/Logs/<name>; other platforms keep them inside
  // userData, which has already moved. Logs are disposable, so failures are ignored.
  if (platform === 'darwin' && !isDevelopment) {
    const logsRoot = path.join(app.getPath('home'), 'Library', 'Logs')
    const logs = migrateDataDirectory({ oldDir: path.join(logsRoot, LEGACY_APP_NAME), newDir: path.join(logsRoot, brandName), fs })
    results.push({ scope: 'logs', ...logs })
    app.setAppLogsPath(logs.dir)
  }
  return results
}

module.exports = {
  LEGACY_APP_NAME,
  LEGACY_DEV_PROFILE_NAME,
  MIGRATION_MARKER,
  OLD_FOLDER_NOTE,
  applyStagelessProfile,
  migrateDataDirectory,
}
