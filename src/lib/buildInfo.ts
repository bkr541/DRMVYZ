/** The build a tester is running (vite.config.ts writes it in at build time). Tests and tools without it see a "dev" build. */
declare const __STAGELESS_BUILD__: { version: string; commit: string; builtAt: string } | undefined

export interface BuildInfo { version: string; commit: string; builtAt: string }

export const BUILD_INFO: BuildInfo = typeof __STAGELESS_BUILD__ !== 'undefined' && __STAGELESS_BUILD__
  ? __STAGELESS_BUILD__
  : { version: 'dev', commit: 'unknown', builtAt: '' }

/** For example "1.0.0-beta.1 (a1b2c3d, 28 Nov 2026)". */
export function buildLabel(info: BuildInfo = BUILD_INFO): string {
  const date = info.builtAt ? new Date(info.builtAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  return `${info.version} (${[info.commit, date].filter(Boolean).join(', ')})`
}
