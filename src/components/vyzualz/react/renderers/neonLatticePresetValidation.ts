import {
  DEFAULT_NEON_LATTICE_SETTINGS,
  type NeonLatticePaletteRole,
  type NeonLatticePhraseAction,
  type NeonLatticePhraseScale,
  type NeonLatticeSettings,
  type ReactPreset,
} from '../ReactTypes'
import { normalizeNeonLatticeSettings } from '../NeonLatticeConfig'
import { validateNeonLatticePhraseCompleteness } from './neonLatticeAudioDirector'

export const STABLE_NEON_LATTICE_PRESET_IDS = [
  'preset-nl-acid-magenta',
  'preset-nl-drmvyz-lattice',
  'preset-nl-sparse-starlines',
  'preset-nl-overload-matrix',
] as const

const PHRASE_SCALES: NeonLatticePhraseScale[] = [4, 8, 16, 32]
const PALETTE_ROLES = new Set<NeonLatticePaletteRole>([
  'primary', 'secondary', 'accent', 'highlight', 'background',
])

export interface NeonLatticePresetValidationIssue {
  presetId: string
  code: string
  message: string
}

export interface NeonLatticePresetLibraryValidation {
  valid: boolean
  issues: NeonLatticePresetValidationIssue[]
  choreographySignatures: Readonly<Record<string, string>>
}

function stableActionSignature(action: NeonLatticePhraseAction): string {
  const entries = Object.entries(action)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
  return entries.join(',')
}

export function neonLatticePhraseActionSignature(
  settings: NeonLatticeSettings,
  scale: NeonLatticePhraseScale,
): string {
  return settings.phrasePrograms
    .filter(program => program.phraseBeats === scale)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(program => program.actions.map(stableActionSignature).join('>'))
    .join('||')
}

export function neonLatticeChoreographySignature(settings: NeonLatticeSettings): string {
  const phraseSignature = PHRASE_SCALES
    .map(scale => `${scale}:${neonLatticePhraseActionSignature(settings, scale)}`)
    .join('|')
  const stepSignature = settings.lanePattern.steps
    .map(step => [
      step.rest === true ? 'rest' : step.lanes.join(','),
      step.orientation ?? 'pattern',
      step.mirrored === true ? 'mirror' : 'direct',
      step.paletteRole ?? 'primary',
      step.chordSize ?? 1,
    ].join(':'))
    .join(';')
  return [
    settings.compositionMode,
    settings.lanePattern.id,
    settings.lanePattern.laneCount,
    settings.lanePattern.orientations.join(','),
    stepSignature,
    phraseSignature,
  ].join('::')
}

function collectPaletteRoles(settings: NeonLatticeSettings): Array<NeonLatticePaletteRole | undefined> {
  return [
    settings.cyanStrikePaletteRole,
    ...settings.customSegments.map(segment => segment.paletteRole),
    ...settings.lanePattern.steps.map(step => step.paletteRole),
    ...settings.phrasePrograms.flatMap(program => program.actions.flatMap(action => {
      if ('paletteRole' in action) return [action.paletteRole]
      if (action.type === 'paletteStep') return [action.role]
      return []
    })),
  ]
}

function issue(
  issues: NeonLatticePresetValidationIssue[],
  presetId: string,
  code: string,
  message: string,
): void {
  issues.push({ presetId, code, message })
}

export function validateNeonLatticePresetLibrary(
  presets: readonly ReactPreset[],
): NeonLatticePresetLibraryValidation {
  const issues: NeonLatticePresetValidationIssue[] = []
  const signatures: Record<string, string> = {}
  const allIds = new Set<string>()
  const duplicateIds = new Set<string>()

  for (const preset of presets) {
    if (allIds.has(preset.id)) duplicateIds.add(preset.id)
    allIds.add(preset.id)
  }
  for (const id of duplicateIds) issue(issues, id, 'duplicate-id', 'Preset ID is not unique.')

  const neonPresets = presets.filter(preset => preset.engine === 'neonLattice')
  for (const stableId of STABLE_NEON_LATTICE_PRESET_IDS) {
    if (!neonPresets.some(preset => preset.id === stableId)) {
      issue(issues, stableId, 'missing-stable-id', 'Required backward-compatible preset ID is missing.')
    }
  }

  const signatureOwners = new Map<string, string>()
  for (const preset of neonPresets) {
    const normalized = normalizeNeonLatticeSettings({
      ...DEFAULT_NEON_LATTICE_SETTINGS,
      ...preset.neonLatticeSettings,
    })
    const renormalized = normalizeNeonLatticeSettings(normalized)
    if (JSON.stringify(normalized) !== JSON.stringify(renormalized)) {
      issue(issues, preset.id, 'non-idempotent-normalization', 'Normalized settings change when normalized a second time.')
    }

    const weights = Object.values(normalized.orientationWeights)
    const weightSum = weights.reduce((sum, value) => sum + value, 0)
    if (weights.some(value => !Number.isFinite(value) || value < 0) || Math.abs(weightSum - 1) > 1e-6) {
      issue(issues, preset.id, 'invalid-orientation-weights', 'Orientation weights must be finite, non-negative, and normalized.')
    }

    const pattern = normalized.lanePattern
    if (pattern.steps.length !== pattern.sequenceLength || pattern.steps.length === 0) {
      issue(issues, preset.id, 'invalid-lane-pattern', 'Lane pattern steps must match its non-zero sequence length.')
    }
    if (pattern.steps.some(step => step.lanes.some(lane => lane < 0 || lane >= pattern.laneCount))) {
      issue(issues, preset.id, 'invalid-lane-index', 'Lane pattern contains an out-of-range lane index.')
    }

    const invalidRole = collectPaletteRoles(normalized).find(
      (role): role is NeonLatticePaletteRole => role != null && !PALETTE_ROLES.has(role),
    )
    if (invalidRole != null) {
      issue(issues, preset.id, 'invalid-palette-role', `Unknown semantic palette role: ${invalidRole}`)
    }

    const phraseValidation = validateNeonLatticePhraseCompleteness(normalized)
    if (!phraseValidation.valid) {
      issue(
        issues,
        preset.id,
        'invalid-phrase-programs',
        `Phrase choreography is incomplete or duplicated (missing: ${phraseValidation.missing.join(',') || 'none'}).`,
      )
    }
    for (const scale of PHRASE_SCALES) {
      if (!neonLatticePhraseActionSignature(normalized, scale)) {
        issue(issues, preset.id, `missing-phrase-${scale}`, `${scale}-beat choreography is not intentional.`)
      }
    }

    const signature = neonLatticeChoreographySignature(normalized)
    signatures[preset.id] = signature
    const priorOwner = signatureOwners.get(signature)
    if (priorOwner) {
      issue(issues, preset.id, 'duplicate-choreography-signature', `Choreography matches ${priorOwner}.`)
    } else {
      signatureOwners.set(signature, preset.id)
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    choreographySignatures: Object.freeze({ ...signatures }),
  }
}
