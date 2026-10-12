'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const INDEX_SCHEMA_VERSION = 1

function rootKey(rootPath) {
  return crypto.createHash('sha1').update(path.resolve(rootPath)).digest('hex').slice(0, 16)
}

function normalizeLookupValue(value) {
  return String(value || '').trim().replace(/\\/g, '/').toLowerCase()
}

function buildTrackLookup(tracks) {
  const byLocation = Object.create(null)
  const byFilename = Object.create(null)
  tracks.forEach((track, index) => {
    const location = normalizeLookupValue(track.location)
    const filename = normalizeLookupValue(track.filename || (location ? path.posix.basename(location) : ''))
    if (location) byLocation[location] = index
    if (filename) (byFilename[filename] ||= []).push(index)
  })
  return { byLocation, byFilename }
}

function createRekordboxIndexStore({ baseDir }) {
  if (!baseDir) throw new Error('A Rekordbox index directory is required.')
  const manifestPath = path.join(baseDir, 'manifest.json')

  async function readJson(filePath, fallback) {
    try {
      return JSON.parse(await fs.readFile(filePath, 'utf8'))
    } catch (error) {
      if (error?.code === 'ENOENT') return fallback
      throw error
    }
  }

  async function readManifest() {
    return readJson(manifestPath, { schemaVersion: INDEX_SCHEMA_VERSION, selectedRootPath: null, indexes: {} })
  }

  async function writeJson(filePath, value) {
    await fs.mkdir(baseDir, { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(value), 'utf8')
  }

  function toStatus(manifest) {
    const selectedRootPath = manifest.selectedRootPath || null
    const selectedRootName = selectedRootPath ? path.basename(selectedRootPath) : null
    const indexed = selectedRootPath ? manifest.indexes?.[rootKey(selectedRootPath)] : null
    return {
      available: true,
      selectedRootPath,
      selectedRootName,
      hasIndex: Boolean(indexed),
      syncedAt: indexed?.syncedAt ?? null,
      parserMode: indexed?.parserMode ?? null,
      trackCount: indexed?.trackCount ?? 0,
      detectedPdbFiles: indexed?.detectedPdbFiles ?? 0,
      detectedAnlzFiles: indexed?.detectedAnlzFiles ?? 0,
      warningCount: indexed?.warningCount ?? 0,
    }
  }

  async function getStatus() {
    return toStatus(await readManifest())
  }

  async function selectRoot(rootPath) {
    const resolvedRoot = path.resolve(rootPath)
    const manifest = await readManifest()
    manifest.schemaVersion = INDEX_SCHEMA_VERSION
    manifest.selectedRootPath = resolvedRoot
    manifest.indexes ||= {}
    await writeJson(manifestPath, manifest)
    return toStatus(manifest)
  }

  async function persistScan(rootPath, result) {
    if (!result?.library) throw new Error('The Rekordbox scan did not produce a library to index.')
    const resolvedRoot = path.resolve(rootPath)
    const key = rootKey(resolvedRoot)
    const syncedAt = new Date().toISOString()
    const payload = {
      schemaVersion: INDEX_SCHEMA_VERSION,
      rootPath: resolvedRoot,
      rootName: path.basename(resolvedRoot),
      syncedAt,
      library: result.library,
      lookup: buildTrackLookup(result.library.tracks),
    }
    await writeJson(path.join(baseDir, `${key}.json`), payload)

    const manifest = await readManifest()
    manifest.schemaVersion = INDEX_SCHEMA_VERSION
    manifest.selectedRootPath = resolvedRoot
    manifest.indexes ||= {}
    manifest.indexes[key] = {
      syncedAt,
      parserMode: result.parserMode ?? null,
      trackCount: result.library.tracks.length,
      detectedPdbFiles: result.detectedPdbFiles ?? 0,
      detectedAnlzFiles: result.detectedAnlzFiles ?? 0,
      warningCount: result.warnings?.length ?? 0,
    }
    await writeJson(manifestPath, manifest)
    return toStatus(manifest)
  }

  return { getStatus, selectRoot, persistScan }
}

module.exports = { createRekordboxIndexStore, buildTrackLookup, INDEX_SCHEMA_VERSION }
