import type { SupabaseClient } from '@supabase/supabase-js'
import { BUILD_INFO, buildLabel } from '../../lib/buildInfo'
import { getRecentLogEntries } from '../../lib/logger'
import { supabase, supabaseConfigured } from '../../lib/supabase'

/** A beta issue report (migration 0066). */
export type IssueCategory = 'rendering' | 'audio' | 'media' | 'output' | 'account' | 'performance' | 'other'

export const ISSUE_CATEGORIES: readonly { value: IssueCategory; label: string; description: string }[] = [
  { value: 'rendering', label: 'Visuals and presets', description: 'A preset looks wrong, freezes, flickers or will not load.' },
  { value: 'performance', label: 'Speed and stability', description: 'Low frame rate, stutter, a crash or the app getting slower.' },
  { value: 'audio', label: 'Audio and music', description: 'Playback, live input, BPM or the music analysis.' },
  { value: 'media', label: 'Media and projects', description: 'Uploads, Media Pools, Shows, pads or saved work.' },
  { value: 'output', label: 'Output and casting', description: 'External screens, casting, recording.' },
  { value: 'account', label: 'Account and sign-in', description: 'Signing in, your profile or settings.' },
  { value: 'other', label: 'Something else', description: 'Anything not listed above.' },
]

const MAX_LOG_ENTRIES = 150
const MAX_TEXT = 4000

/**
 * Makes diagnostic text safe to send: links keep only their origin and path (signed Storage links carry tokens in the query), local file
 * paths lose the user folder, and tokens, long identifiers and email addresses are removed.
 */
export function sanitizeDiagnosticText(text: string): string {
  return text
    .replace(/\b(?:https?|wss?):\/\/[^\s"'<>)\]]+/gi, match => {
      try { const url = new URL(match); return `${url.origin}${url.pathname}` } catch { return '<link>' }
    })
    .replace(/\b(?:file|drmvyz-app):\/\/[^\s"'<>)\]]+/gi, '<app-file>')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '<token>')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '<email>')
    .replace(/(\/Users\/|\/home\/)[^/\s"']+/g, '~')
    .replace(/[A-Za-z]:\\Users\\[^\\\s"']+/g, '~')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '<id>')
}

function graphicsRenderer(): string | null {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl')
    if (!gl) return null
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    return String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
  } catch {
    return null
  }
}

export interface IssueDiagnosticsContext {
  /** What the app was doing: the active engine and preset, casting, and the like. Values are sanitized. */
  activity?: Readonly<Record<string, string | number | boolean | null>>
}

/** Everything a report can carry besides the tester's own words. Nothing here identifies the tester. */
export function collectIssueDiagnostics(context: IssueDiagnosticsContext = {}): Record<string, unknown> {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return {
    build: BUILD_INFO,
    platform: window.drmvyzNative?.runtime?.platform ?? 'web',
    desktopApp: Boolean(window.drmvyzNative?.runtime?.isElectron),
    userAgent: navigator.userAgent,
    graphics: graphicsRenderer(),
    cpuCores: nav.hardwareConcurrency ?? null,
    memoryGb: nav.deviceMemory ?? null,
    screen: { width: window.screen.width, height: window.screen.height, pixelRatio: window.devicePixelRatio },
    online: navigator.onLine,
    activity: Object.fromEntries(Object.entries(context.activity ?? {}).map(([key, value]) => [key, typeof value === 'string' ? sanitizeDiagnosticText(value) : value])),
    recentLog: getRecentLogEntries(MAX_LOG_ENTRIES).map(entry => ({
      time: new Date(entry.timestamp).toISOString(),
      level: entry.level,
      category: entry.category,
      message: sanitizeDiagnosticText(entry.message),
      ...(entry.context !== undefined ? { context: sanitizeDiagnosticText(safeJson(entry.context)).slice(0, 1000) } : {}),
    })),
  }
}

function safeJson(value: unknown): string {
  try { return JSON.stringify(value) } catch { return String(value) }
}

export interface IssueReportInput {
  category: IssueCategory
  summary: string
  steps: string
  includeDiagnostics: boolean
  context?: IssueDiagnosticsContext
}

export function validateIssueReport(input: Pick<IssueReportInput, 'summary' | 'steps'>): string | null {
  if (!input.summary.trim()) return 'Say what happened.'
  if (input.summary.length > MAX_TEXT || input.steps.length > MAX_TEXT) return `At most ${MAX_TEXT.toLocaleString()} characters in each box.`
  return null
}

/** The row sent to Supabase. Exported for tests. */
export function issueReportRow(input: IssueReportInput) {
  return {
    category: input.category,
    summary: input.summary.trim(),
    steps: input.steps.trim() || null,
    app_version: BUILD_INFO.version,
    app_build: buildLabel(),
    diagnostics: input.includeDiagnostics ? collectIssueDiagnostics(input.context) : null,
  }
}

export async function sendIssueReport(input: IssueReportInput): Promise<void> {
  if (!supabaseConfigured) throw new Error('Reports cannot be sent: this build is not connected to the STAGELESS service.')
  const { error } = await (supabase as unknown as SupabaseClient).from('beta_issue_reports').insert(issueReportRow(input))
  if (error) throw new Error(/limit/i.test(error.message) ? 'You have sent the most reports allowed today. Please try again tomorrow.' : error.message)
}
