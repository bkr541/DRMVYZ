import type { Cinema2CompiledParameterDefinition } from './Cinema2ParameterSchema'

// The app-wide Auto Performance default lives in lib/ so every engine reads the same value; Cinema 2.0 uses it under its own names.
export {
  getAutoPerformanceUserDefault as getCinema2AutoPerformanceUserDefault,
  setAutoPerformanceUserDefault as setCinema2AutoPerformanceUserDefault,
  subscribeAutoPerformanceUserDefault as subscribeCinema2AutoPerformanceUserDefault,
} from '../../../../lib/autoPerformanceDefault'

/**
 * A preset's Auto Performance toggle: a boolean tagged `moodPolicy: 'autoPerformance'` (every preset migrated to the shared Mood Conductor), or
 * any boolean labelled "Auto Performance" (presets not migrated yet), so the user's default reaches every preset that has the toggle.
 */
export function isCinema2AutoPerformanceToggle(definition: Readonly<Pick<Cinema2CompiledParameterDefinition, 'type' | 'metadata' | 'label'>>): boolean {
  if (definition.type !== 'boolean') return false
  return definition.metadata?.moodPolicy === 'autoPerformance' || definition.label?.trim().toLowerCase() === 'auto performance'
}
