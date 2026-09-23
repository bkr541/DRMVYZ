/**
 * Top-level "which part of the app" taxonomy for troubleshooting logs —
 * coarser than a log entry's `scope` (a specific module/category name).
 * Used by the renderer logger, the main-process scope convention, and the
 * Settings → Developer → Logging table's Component column/filter.
 */
export const LOG_COMPONENTS = [
  'react',
  'show-manager',
  'rekordbox',
  'output',
  'lyrics',
  'music-intelligence',
  'brand-kit',
  'settings',
  'auth',
  'system',
] as const

export type LogComponent = typeof LOG_COMPONENTS[number]

export const LOG_COMPONENT_LABELS: Record<LogComponent, string> = {
  react: 'React',
  'show-manager': 'Show Manager',
  rekordbox: 'Rekordbox',
  output: 'Output',
  lyrics: 'Lyrics',
  'music-intelligence': 'Music Intelligence',
  'brand-kit': 'Brand Kit',
  settings: 'Settings',
  auth: 'Auth',
  system: 'System',
}

export function isLogComponent(value: string): value is LogComponent {
  return (LOG_COMPONENTS as readonly string[]).includes(value)
}
