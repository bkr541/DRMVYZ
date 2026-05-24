/**
 * Built-in color grade "Looks" presets for the DRMVYZ color grading system.
 *
 * Each preset is a partial VzColorGrade covering the Phase 1 wired fields
 * (brightness, contrast, saturation, hueRotation, temperature, tint). Applying
 * a preset merges these values onto the existing grade, preserving enabled and
 * any future/reserved fields.
 */

import type { VzColorGrade } from '../types/vzColorGrade'
import { DEFAULT_COLOR_GRADE } from '../types/vzColorGrade'

/** The subset of grade fields a Look preset controls. */
export type ColorGradeLook = Pick<
  VzColorGrade,
  'brightness' | 'contrast' | 'saturation' | 'hueRotation' | 'temperature' | 'tint'
>

export interface ColorGradePreset {
  id: string
  name: string
  look: ColorGradeLook
}

const NEUTRAL: ColorGradeLook = {
  brightness: 0, contrast: 0, saturation: 0, hueRotation: 0, temperature: 0, tint: 0,
}
const AURORA_ENGINE: ColorGradeLook = {
  brightness: -6, contrast: 24, saturation: 18, hueRotation: 0, temperature: -18, tint: -8,
}
const DRMBOY_GLOW: ColorGradeLook = {
  brightness: 8, contrast: 18, saturation: 25, hueRotation: 0, temperature: -14, tint: -10,
}
const HOLLOW_KING_VOID: ColorGradeLook = {
  brightness: -20, contrast: 32, saturation: -28, hueRotation: 14, temperature: -28, tint: 18,
}
const ANCIENT_RELIC_GOLD: ColorGradeLook = {
  brightness: 4, contrast: 20, saturation: 18, hueRotation: 0, temperature: 34, tint: 4,
}
const MONOCHROME_BUILD: ColorGradeLook = {
  brightness: -8, contrast: 20, saturation: -100, hueRotation: 0, temperature: 0, tint: 0,
}

export const COLOR_GRADE_PRESETS: ColorGradePreset[] = [
  { id: 'neutral',            name: 'Neutral',            look: NEUTRAL },
  { id: 'aurora-engine',      name: 'Aurora Engine',      look: AURORA_ENGINE },
  { id: 'drmboy-glow',        name: 'DRMBOY Glow',        look: DRMBOY_GLOW },
  { id: 'hollow-king-void',   name: 'Hollow King Void',   look: HOLLOW_KING_VOID },
  { id: 'ancient-relic-gold', name: 'Ancient Relic Gold', look: ANCIENT_RELIC_GOLD },
  { id: 'monochrome-build',   name: 'Monochrome Build',   look: MONOCHROME_BUILD },
]

/**
 * Produce a full VzColorGrade from a preset, merged onto a base grade.
 * Preserves the base's enabled flag and any reserved/future fields.
 */
export function applyColorGradePreset(
  presetId: string,
  base?: VzColorGrade,
): VzColorGrade | null {
  const preset = COLOR_GRADE_PRESETS.find(p => p.id === presetId)
  if (!preset) return null
  const start = base ?? DEFAULT_COLOR_GRADE
  return { ...start, ...preset.look }
}

/**
 * Find the preset id whose look exactly matches the given grade's wired fields,
 * or null if none match (custom grade). Used to reflect the current state in
 * the Looks dropdown.
 */
export function matchColorGradePreset(grade?: VzColorGrade): string | null {
  const g = grade ?? DEFAULT_COLOR_GRADE
  for (const p of COLOR_GRADE_PRESETS) {
    if (
      p.look.brightness === g.brightness &&
      p.look.contrast === g.contrast &&
      p.look.saturation === g.saturation &&
      p.look.hueRotation === g.hueRotation &&
      p.look.temperature === g.temperature &&
      p.look.tint === g.tint
    ) {
      return p.id
    }
  }
  return null
}
