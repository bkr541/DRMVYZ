import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, relative, resolve, sep } from 'node:path'

export const AUDIO_INTELLIGENCE_MANIFEST_SCHEMA_VERSION = 1
export const AUDIO_INTELLIGENCE_SIDECAR_SUFFIX = '.drmvyz-ai.json'
export const DEFAULT_AUDIO_EXTENSIONS = Object.freeze([
  '.wav',
  '.mp3',
  '.flac',
  '.m4a',
  '.mp4',
  '.ogg',
])

export function normalizeExtensions(extensions = DEFAULT_AUDIO_EXTENSIONS) {
  const normalized = new Set()
  for (const rawExtension of extensions) {
    const trimmed = String(rawExtension).trim().toLowerCase()
    if (!trimmed) continue
    normalized.add(trimmed.startsWith('.') ? trimmed : `.${trimmed}`)
  }
  if (normalized.size === 0) throw new Error('At least one audio extension is required.')
  return normalized
}

export function isHiddenPathSegment(name) {
  return name.startsWith('.') && name !== '.' && name !== '..'
}

export function isSupportedAudioPath(filePath, extensions = DEFAULT_AUDIO_EXTENSIONS) {
  return normalizeExtensions(extensions).has(extname(filePath).toLowerCase())
}

export async function discoverAudioFiles(inputDirectory, options = {}) {
  const root = resolve(inputDirectory)
  const recursive = Boolean(options.recursive)
  const includeHidden = Boolean(options.includeHidden)
  const extensions = normalizeExtensions(options.extensions)
  const discovered = []

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))

    for (const entry of entries) {
      if (!includeHidden && isHiddenPathSegment(entry.name)) continue
      const entryPath = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        if (recursive) await visit(entryPath)
        continue
      }
      if (entry.isFile() && extensions.has(extname(entry.name).toLowerCase())) discovered.push(entryPath)
    }
  }

  await visit(root)
  return discovered.sort((left, right) => left.localeCompare(right))
}

export function sidecarPathFor(audioPath) {
  const extension = extname(audioPath)
  const withoutExtension = extension ? audioPath.slice(0, -extension.length) : audioPath
  return `${withoutExtension}${AUDIO_INTELLIGENCE_SIDECAR_SUFFIX}`
}

export function toPortableRelativePath(rootDirectory, targetPath) {
  return relative(resolve(rootDirectory), resolve(targetPath)).split(sep).join('/')
}

export function resolveGenreMetadata(audioPath, inputDirectory, options = {}) {
  const labels = []
  const manualLabels = Array.isArray(options.manualLabels) ? options.manualLabels : []
  let hasManualLabels = false
  for (const label of manualLabels) {
    const normalized = String(label).trim()
    if (!normalized) continue
    hasManualLabels = true
    if (!labels.includes(normalized)) labels.push(normalized)
  }

  let parentLabel = ''
  if (options.genreFromParent) {
    const relativeAudioPath = toPortableRelativePath(inputDirectory, audioPath)
    const pathParts = relativeAudioPath.split('/')
    if (pathParts.length > 1) parentLabel = pathParts[pathParts.length - 2]?.trim() || ''
    if (parentLabel && !labels.includes(parentLabel)) labels.push(parentLabel)
  }

  let labelSource = 'none'
  if (hasManualLabels && parentLabel) labelSource = 'manual-and-parent-directory'
  else if (hasManualLabels) labelSource = 'manual'
  else if (parentLabel) labelSource = 'parent-directory'

  return { genreLabels: labels, labelSource }
}

export async function sha256File(filePath) {
  const hash = createHash('sha256')
  await new Promise((resolveHash, reject) => {
    const stream = createReadStream(filePath)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', resolveHash)
  })
  return hash.digest('hex')
}

export function validateExistingSidecar(fixture, expected) {
  if (!fixture || typeof fixture !== 'object') return { current: false, reason: 'invalid-root' }
  if (fixture.schemaVersion !== expected.schemaVersion) return { current: false, reason: 'schema-version' }
  if (fixture.source?.sha256 !== expected.sourceSha256) return { current: false, reason: 'source-hash' }
  if (fixture.analyzers?.trackAnalysisVersion !== expected.trackAnalysisVersion) {
    return { current: false, reason: 'track-analysis-version' }
  }
  if (fixture.analyzers?.rgbWaveformVersion !== expected.rgbWaveformVersion) {
    return { current: false, reason: 'rgb-waveform-version' }
  }
  if (!fixture.payload?.trackAnalysis || !fixture.payload?.rgbWaveform) {
    return { current: false, reason: 'incomplete-payload' }
  }
  if (!fixture.byteComparison?.payloadSha256) return { current: false, reason: 'payload-hash' }
  const actualPayloadSha256 = sha256Text(canonicalSortedJson(fixture.payload))
  if (actualPayloadSha256 !== fixture.byteComparison.payloadSha256) {
    return { current: false, reason: 'payload-hash' }
  }
  return { current: true, reason: 'current' }
}

export async function inspectExistingSidecar(sidecarPath, expected) {
  try {
    const source = await readFile(sidecarPath, 'utf8')
    const fixture = JSON.parse(source)
    const validation = validateExistingSidecar(fixture, expected)
    return { ...validation, fixture }
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return { current: false, reason: 'missing' }
    }
    return {
      current: false,
      reason: error instanceof SyntaxError ? 'invalid-json' : 'unreadable',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function atomicWriteFile(targetPath, contents) {
  const absoluteTarget = resolve(targetPath)
  await mkdir(dirname(absoluteTarget), { recursive: true })
  const temporaryPath = `${absoluteTarget}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  try {
    await writeFile(temporaryPath, contents)
    try {
      await rename(temporaryPath, absoluteTarget)
    } catch (error) {
      if (!error || typeof error !== 'object' || !['EEXIST', 'EPERM'].includes(error.code)) throw error
      await rm(absoluteTarget, { force: true })
      await rename(temporaryPath, absoluteTarget)
    }
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
  }
}

export function extractManifestTrackRecord({
  fixture,
  audioPath,
  sidecarPath,
  inputDirectory,
  genreLabels,
  labelSource,
  batchDisposition,
  staleReason,
}) {
  const trackAnalysis = fixture?.payload?.trackAnalysis || {}
  const warningCount = Array.isArray(trackAnalysis.warnings) ? trackAnalysis.warnings.length : 0
  const errorCount = Array.isArray(trackAnalysis.errors) ? trackAnalysis.errors.length : 0
  const sectionCount = Array.isArray(trackAnalysis.sections) ? trackAnalysis.sections.length : 0

  return {
    sourceRelativePath: toPortableRelativePath(inputDirectory, audioPath),
    analysisRelativePath: toPortableRelativePath(inputDirectory, sidecarPath),
    genreLabels,
    labelSource,
    sourceSha256: fixture?.source?.sha256 || null,
    payloadSha256: fixture?.byteComparison?.payloadSha256 || null,
    status: 'complete',
    batchDisposition,
    staleReason: staleReason || null,
    durationSec: numberOrNull(fixture?.decodedAudio?.durationSec),
    bpm: numberOrNull(trackAnalysis.bpm),
    bpmConfidence: numberOrNull(trackAnalysis.bpmConfidence),
    sectionCount,
    warningCount,
    errorCount,
  }
}

export function createFailedManifestTrackRecord({
  audioPath,
  sidecarPath,
  inputDirectory,
  genreLabels,
  labelSource,
  error,
}) {
  return {
    sourceRelativePath: toPortableRelativePath(inputDirectory, audioPath),
    analysisRelativePath: toPortableRelativePath(inputDirectory, sidecarPath),
    genreLabels,
    labelSource,
    sourceSha256: null,
    payloadSha256: null,
    status: 'failed',
    batchDisposition: 'failed',
    staleReason: null,
    durationSec: null,
    bpm: null,
    bpmConfidence: null,
    sectionCount: 0,
    warningCount: 0,
    errorCount: 1,
    error: error instanceof Error ? error.message : String(error),
  }
}

export function summarizeBatch(discoveredCount, trackRecords) {
  let completed = 0
  let skipped = 0
  let failed = 0
  for (const track of trackRecords) {
    if (track.batchDisposition === 'analyzed') completed += 1
    else if (track.batchDisposition === 'skipped') skipped += 1
    else if (track.batchDisposition === 'failed') failed += 1
  }
  return { discovered: discoveredCount, completed, skipped, failed }
}

export function createDatasetManifest({
  inputDirectory,
  analyzerVersions,
  trackRecords,
  discoveredCount,
  createdAt,
  updatedAt,
  interrupted = false,
  command,
}) {
  const sortedTracks = [...trackRecords].sort((left, right) => left.sourceRelativePath.localeCompare(right.sourceRelativePath))
  return {
    schemaVersion: AUDIO_INTELLIGENCE_MANIFEST_SCHEMA_VERSION,
    createdAt,
    updatedAt,
    inputDirectory: resolve(inputDirectory),
    analyzerVersions,
    command,
    interrupted,
    summary: summarizeBatch(discoveredCount, sortedTracks),
    tracks: sortedTracks,
  }
}

export function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function canonicalSortedJson(value) {
  return `${JSON.stringify(sortJsonValue(value), null, 2)}\n`
}

export function sha256Text(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function displayPath(filePath, inputDirectory) {
  const relativePath = toPortableRelativePath(inputDirectory, filePath)
  return relativePath || basename(filePath)
}

function sortJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortJsonValue)
  if (value && typeof value === 'object') {
    const sorted = {}
    for (const key of Object.keys(value).sort((left, right) => left.localeCompare(right))) {
      sorted[key] = sortJsonValue(value[key])
    }
    return sorted
  }
  return value
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
