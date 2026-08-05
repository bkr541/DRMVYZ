import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import {
  atomicWriteFile,
  canonicalSortedJson,
  createDatasetManifest,
  discoverAudioFiles,
  inspectExistingSidecar,
  resolveGenreMetadata,
  sha256Text,
  sidecarPathFor,
  summarizeBatch,
  toPortableRelativePath,
  validateExistingSidecar,
} from './audio-intelligence-batch-core.mjs'

async function withTempDirectory(run) {
  const directory = await mkdtemp(join(tmpdir(), 'drmvyz-audio-batch-test-'))
  try {
    return await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function fixture(overrides = {}) {
  const payload = overrides.payload || {
    trackAnalysis: { sections: [], warnings: [], errors: [] },
    rgbWaveform: { version: 1 },
  }
  return {
    schemaVersion: 1,
    source: { sha256: 'source-hash' },
    analyzers: {
      trackAnalysisVersion: 'auto-6.0',
      rgbWaveformVersion: 1,
    },
    byteComparison: { payloadSha256: sha256Text(canonicalSortedJson(payload)) },
    payload,
    ...overrides,
  }
}

const expected = {
  schemaVersion: 1,
  sourceSha256: 'source-hash',
  trackAnalysisVersion: 'auto-6.0',
  rgbWaveformVersion: 1,
}

test('discovers supported audio files non-recursively and case-insensitively', async () => {
  await withTempDirectory(async directory => {
    await writeFile(join(directory, 'a.WAV'), 'a')
    await writeFile(join(directory, 'b.mp3'), 'b')
    await writeFile(join(directory, 'notes.txt'), 'no')
    await mkdir(join(directory, 'nested'))
    await writeFile(join(directory, 'nested', 'c.flac'), 'c')

    const files = await discoverAudioFiles(directory)
    assert.deepEqual(files.map(file => toPortableRelativePath(directory, file)), ['a.WAV', 'b.mp3'])
  })
})

test('recursively discovers nested tracks while excluding hidden paths by default', async () => {
  await withTempDirectory(async directory => {
    await mkdir(join(directory, 'House'), { recursive: true })
    await mkdir(join(directory, '.private'), { recursive: true })
    await writeFile(join(directory, 'House', 'track.ogg'), 'track')
    await writeFile(join(directory, '.private', 'hidden.wav'), 'hidden')
    await writeFile(join(directory, '.secret.mp3'), 'hidden')

    const files = await discoverAudioFiles(directory, { recursive: true })
    assert.deepEqual(files.map(file => toPortableRelativePath(directory, file)), ['House/track.ogg'])

    const hiddenFiles = await discoverAudioFiles(directory, { recursive: true, includeHidden: true })
    assert.deepEqual(hiddenFiles.map(file => toPortableRelativePath(directory, file)), [
      '.private/hidden.wav',
      '.secret.mp3',
      'House/track.ogg',
    ])
  })
})

test('supports custom extension filtering', async () => {
  await withTempDirectory(async directory => {
    await writeFile(join(directory, 'track.wav'), 'wav')
    await writeFile(join(directory, 'track.aiff'), 'aiff')
    const files = await discoverAudioFiles(directory, { extensions: ['aiff'] })
    assert.deepEqual(files.map(file => toPortableRelativePath(directory, file)), ['track.aiff'])
  })
})

test('creates sidecar names beside source audio', () => {
  assert.equal(sidecarPathFor('/music/name with spaces.MP3'), '/music/name with spaces.drmvyz-ai.json')
})

test('derives genre labels from the immediate parent and manual labels', () => {
  const root = resolve('/dataset')
  const metadata = resolveGenreMetadata(resolve('/dataset/Bass/Melodic/track.wav'), root, {
    genreFromParent: true,
    manualLabels: ['Cinematic', 'Cinematic'],
  })
  assert.deepEqual(metadata, {
    genreLabels: ['Cinematic', 'Melodic'],
    labelSource: 'manual-and-parent-directory',
  })

  assert.deepEqual(resolveGenreMetadata(resolve('/dataset/track.wav'), root, { genreFromParent: true }), {
    genreLabels: [],
    labelSource: 'none',
  })
})

test('validates current source hashes, analyzer versions, and complete payloads', () => {
  assert.deepEqual(validateExistingSidecar(fixture(), expected), { current: true, reason: 'current' })
  assert.equal(validateExistingSidecar(fixture({ source: { sha256: 'changed' } }), expected).reason, 'source-hash')
  assert.equal(validateExistingSidecar(fixture({
    analyzers: { trackAnalysisVersion: 'old', rgbWaveformVersion: 1 },
  }), expected).reason, 'track-analysis-version')
  assert.equal(validateExistingSidecar(fixture({ payload: {} }), expected).reason, 'incomplete-payload')
  assert.equal(validateExistingSidecar(fixture({
    byteComparison: { payloadSha256: 'tampered' },
  }), expected).reason, 'payload-hash')
})

test('treats corrupt sidecars as stale instead of throwing', async () => {
  await withTempDirectory(async directory => {
    const sidecar = join(directory, 'track.drmvyz-ai.json')
    await writeFile(sidecar, '{not json')
    const result = await inspectExistingSidecar(sidecar, expected)
    assert.equal(result.current, false)
    assert.equal(result.reason, 'invalid-json')
  })
})

test('atomically replaces files with complete contents', async () => {
  await withTempDirectory(async directory => {
    const target = join(directory, 'manifest.json')
    await atomicWriteFile(target, 'first\n')
    await atomicWriteFile(target, 'second\n')
    assert.equal(await readFile(target, 'utf8'), 'second\n')
  })
})

test('summarizes analyzed, skipped, and failed dispositions', () => {
  assert.deepEqual(summarizeBatch(4, [
    { batchDisposition: 'analyzed' },
    { batchDisposition: 'analyzed' },
    { batchDisposition: 'skipped' },
    { batchDisposition: 'failed' },
  ]), { discovered: 4, completed: 2, skipped: 1, failed: 1 })
})

test('creates a stable, sorted dataset manifest', () => {
  const manifest = createDatasetManifest({
    inputDirectory: '/dataset',
    analyzerVersions: { trackAnalysisVersion: 'auto-6.0', rgbWaveformVersion: 1 },
    trackRecords: [
      { sourceRelativePath: 'z.wav', batchDisposition: 'failed' },
      { sourceRelativePath: 'a.wav', batchDisposition: 'analyzed' },
    ],
    discoveredCount: 2,
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T01:00:00.000Z',
    command: { script: 'npm run audio:batch', arguments: [] },
  })

  assert.deepEqual(manifest.summary, { discovered: 2, completed: 1, skipped: 0, failed: 1 })
  assert.deepEqual(manifest.tracks.map(track => track.sourceRelativePath), ['a.wav', 'z.wav'])
})
