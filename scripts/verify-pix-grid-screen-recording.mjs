import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export const PIX_GRID_ACCEPTANCE_PRESET_IDS = Object.freeze([
  'pix-grid-bass-beacon',
  'pix-grid-geometric-reactor',
  'pix-grid-pixel-parade',
])

export const PIX_GRID_RECORDING_CHECKS = Object.freeze([
  'kickReactionsVisible',
  'snareReactionsVisible',
  'sustainedBassVisible',
  'groupedPixelMovementVisible',
  'beatAndBarChangesVisible',
  'buildDevelops',
  'preDropRestrained',
  'dropContrastVisible',
  'secondDropDiffers',
  'silenceSettles',
  'noHiddenControlDependency',
  'noPresetReselectionRequired',
  'canvasChoreographyEquivalent',
  'gpuChoreographyEquivalent',
  'analyserLossRecovers',
  'presetSwitchClearsStaleState',
])

function fail(messages) {
  console.error('PixGrid screen-recording acceptance failed:')
  for (const message of messages) console.error(`- ${message}`)
  process.exitCode = 1
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    throw new Error(`Unable to read ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function validatePixGridRecordingManifest(manifest, manifestPath) {
  const errors = []
  const baseDir = path.dirname(manifestPath)
  if (manifest?.schemaVersion !== 1) errors.push('schemaVersion must be 1.')
  if (manifest?.engine !== 'pixGrid') errors.push('engine must be "pixGrid".')
  if (manifest?.automatedAcceptance?.passed !== true) errors.push('automatedAcceptance.passed must be true after the final PixGrid audit passes.')
  if (typeof manifest?.automatedAcceptance?.command !== 'string' || !manifest.automatedAcceptance.command.includes('verify:pix-grid:final')) {
    errors.push('automatedAcceptance.command must identify the verify:pix-grid:final command that passed.')
  }
  if (!manifest?.automatedAcceptance?.completedAt || Number.isNaN(Date.parse(manifest.automatedAcceptance.completedAt))) errors.push('automatedAcceptance.completedAt must be an ISO date.')
  if (!manifest?.automatedAcceptance?.commit?.trim() || manifest.automatedAcceptance.commit.includes('replace-with')) errors.push('automatedAcceptance.commit must identify the tested commit.')
  if (!manifest?.reviewer?.name?.trim() || manifest.reviewer.name.includes('replace-with')) errors.push('reviewer.name is required.')
  if (!manifest?.reviewer?.reviewedAt || Number.isNaN(Date.parse(manifest.reviewer.reviewedAt))) errors.push('reviewer.reviewedAt must be an ISO date.')

  const recordings = Array.isArray(manifest?.recordings) ? manifest.recordings : []
  for (const presetId of PIX_GRID_ACCEPTANCE_PRESET_IDS) {
    const recording = recordings.find(candidate => candidate?.presetId === presetId)
    if (!recording) {
      errors.push(`Missing recording entry for ${presetId}.`)
      continue
    }
    if (typeof recording.file !== 'string' || !recording.file.trim()) {
      errors.push(`${presetId} is missing a recording file.`)
    } else {
      const resolved = path.resolve(baseDir, recording.file)
      if (!fs.existsSync(resolved)) errors.push(`${presetId} recording file does not exist: ${resolved}`)
      else if (!['.mp4', '.mov', '.webm'].includes(path.extname(resolved).toLowerCase())) errors.push(`${presetId} recording must be MP4, MOV, or WebM.`)
      else if (fs.statSync(resolved).size < 1024) errors.push(`${presetId} recording file is empty or implausibly small.`)
    }
    if (!recording.rendererEvidence?.canvas || !recording.rendererEvidence?.gpu) {
      errors.push(`${presetId} must include Canvas and GPU evidence.`)
    }
    for (const check of PIX_GRID_RECORDING_CHECKS) {
      if (recording.checks?.[check] !== true) errors.push(`${presetId} failed or omitted ${check}.`)
    }
    if (!recording.expectedBehaviorObserved?.trim()) errors.push(`${presetId} must describe the representative behavior observed.`)
  }

  const duplicatePresetIds = recordings
    .map(recording => recording?.presetId)
    .filter((presetId, index, all) => presetId && all.indexOf(presetId) !== index)
  if (duplicatePresetIds.length) errors.push(`Duplicate recording entries: ${[...new Set(duplicatePresetIds)].join(', ')}.`)
  return errors
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (invokedDirectly) {
  const manifestArgument = process.argv[2] ?? process.env.PIX_GRID_SCREEN_RECORDING_MANIFEST
  if (!manifestArgument) {
    fail(['Pass a manifest path, for example: npm run verify:pix-grid:recording -- artifacts/pixgrid-acceptance/manifest.json'])
  } else {
    const manifestPath = path.resolve(process.cwd(), manifestArgument)
    try {
      const errors = validatePixGridRecordingManifest(readJson(manifestPath), manifestPath)
      if (errors.length) fail(errors)
      else console.log(`PixGrid screen-recording evidence accepted: ${manifestPath}`)
    } catch (error) {
      fail([error instanceof Error ? error.message : String(error)])
    }
  }
}
