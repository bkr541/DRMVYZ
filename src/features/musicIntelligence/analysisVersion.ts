/**
 * Shared schema/cache version for loaded-audio analysis.
 *
 * Keep this in the Music Intelligence layer so both the coordinator cache key
 * and the offline analyzer publish the same version without introducing a
 * coordinator -> analyzer dependency cycle.
 */
export const CURRENT_ANALYSIS_VERSION = 'auto-4.0'

export function isCurrentAnalysisVersion(version: string | null | undefined): boolean {
  return version === CURRENT_ANALYSIS_VERSION
}
