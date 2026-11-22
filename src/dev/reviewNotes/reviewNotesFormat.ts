/**
 * Review notes: a temporary, development-only way to leave comments about a preset for later. One markdown file per preset in `.review-notes/` (git-ignored), written
 * by the dev server and read by people and by Claude. Everything here is plain TypeScript with no imports (so the command line tool can load it directly).
 *
 * Each note has a readable body and one machine-readable line, `<!-- note: {json} -->`; that line is the source of truth when the file is read back.
 */
export type ReviewNoteStatus = 'open' | 'done'
/** What a note is about: a bug to fix, a gap (something missing), a change to something that exists, or an idea. */
export const REVIEW_NOTE_KINDS = ['bug', 'gap', 'change', 'idea'] as const
export type ReviewNoteKind = typeof REVIEW_NOTE_KINDS[number]
export const REVIEW_NOTE_KIND_LABELS: Readonly<Record<ReviewNoteKind, string>> = { bug: 'Bug', gap: 'Gap', change: 'Change', idea: 'Idea' }
export const isReviewNoteKind = (value: unknown): value is ReviewNoteKind => (REVIEW_NOTE_KINDS as readonly unknown[]).includes(value)
/** The `engine` of a note about a page or the whole app, not a preset. Its `presetId` is the page (`media`, `admin`, ...) or `general`. */
export const REVIEW_NOTES_APP_ENGINE = 'app'
export const REVIEW_NOTES_MAX_AREA = 120

export interface ReviewNote {
  id: string
  status: ReviewNoteStatus
  createdAt: string
  updatedAt?: string
  text: string
  kind?: ReviewNoteKind
  /** Where in the page the note is about, in the writer's words ("upload modal", "header"). */
  area?: string
  /** Path of the attached screenshot, relative to the repository root. */
  screenshot?: string
  /** What the screen was showing when the note was written (engine, playing, tempo, canvas size, the preset's control values). */
  context?: Record<string, unknown>
  /** What was done about the note, written when it is marked done. */
  resolution?: string
}

export interface ReviewNotesFile {
  engine: string
  presetId: string
  presetName: string
  notes: ReviewNote[]
}

export const REVIEW_NOTES_DIR = '.review-notes'
export const REVIEW_NOTES_SCREENSHOT_DIR = `${REVIEW_NOTES_DIR}/screenshots`
export const REVIEW_NOTES_MAX_TEXT = 20_000

/** A safe file name for a preset: letters, digits, dot, dash and underscore only. */
export function reviewNotesSlug(engine: string, presetId: string): string {
  const clean = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/\.{2,}/g, '.').replace(/^\.+/, '').slice(0, 120) || 'unnamed'
  return `${clean(engine)}__${clean(presetId)}`
}

export function newReviewNoteId(now = Date.now(), random: () => number = Math.random): string {
  return `n_${now.toString(36)}${Math.floor(random() * 36 ** 3).toString(36).padStart(3, '0')}`
}

/** `>` is escaped so a note that contains `-->` cannot end the comment early; the escape is valid JSON, so it reads back as `>`. */
const metaJson = (note: ReviewNote): string => JSON.stringify(note).replace(/>/g, '\\u003e').replace(/</g, '\\u003c')

function contextLine(context: Record<string, unknown> | undefined): string | null {
  if (!context) return null
  const parts: string[] = []
  if (typeof context['playing'] === 'boolean') parts.push(context['playing'] ? 'playing' : 'not playing')
  if (typeof context['bpm'] === 'number') parts.push(`${Math.round(context['bpm'] as number)} BPM`)
  const canvas = context['canvas'] as { width?: number; height?: number } | undefined
  if (canvas?.width && canvas.height) parts.push(`canvas ${canvas.width}x${canvas.height}`)
  if (typeof context['route'] === 'string') parts.push(`on ${context['route']}`)
  return parts.length ? parts.join(', ') : null
}

const stamp = (iso: string) => iso.replace('T', ' ').replace(/:\d\d(\.\d+)?Z$/, 'Z')

function renderNote(note: ReviewNote): string {
  const lines = [
    '---',
    `### [${note.status}] ${note.id} — ${stamp(note.createdAt)}`,
    '',
    `<!-- note: ${metaJson(note)} -->`,
    '',
    note.text.trim(),
    '',
  ]
  if (note.kind || note.area) lines.push(`Type: ${[note.kind ? REVIEW_NOTE_KIND_LABELS[note.kind] : null, note.area ? `Area: ${note.area}` : null].filter(Boolean).join(' · ')}`, '')
  if (note.screenshot) lines.push(`Screenshot: \`${note.screenshot}\``, '')
  const context = contextLine(note.context)
  if (context) lines.push(`Context: ${context}`, '')
  if (note.status === 'done' && note.resolution) lines.push(`Resolved: ${note.resolution.trim()}`, '')
  return lines.join('\n')
}

export function serializeReviewNotes(file: ReviewNotesFile): string {
  const open = file.notes.filter(note => note.status === 'open').length
  const head = [
    `# Review notes — ${file.presetName}`,
    '',
    `Engine: ${file.engine} · Preset id: \`${file.presetId}\` · ${open} open, ${file.notes.length - open} done`,
    '',
    `<!-- review-notes-file: ${JSON.stringify({ engine: file.engine, presetId: file.presetId, presetName: file.presetName }).replace(/>/g, '\\u003e')} -->`,
    '',
  ]
  return `${head.join('\n')}\n${file.notes.map(renderNote).join('\n')}`
}

const isStatus = (value: unknown): value is ReviewNoteStatus => value === 'open' || value === 'done'

/** Reads a file back. Lines it cannot understand are skipped, so a hand-edited file never loses its other notes. */
export function parseReviewNotes(markdown: string): ReviewNotesFile | null {
  const header = /<!-- review-notes-file: (.*?) -->/.exec(markdown)
  if (!header) return null
  let meta: { engine?: unknown; presetId?: unknown; presetName?: unknown }
  try { meta = JSON.parse(header[1]!) } catch { return null }
  if (typeof meta.engine !== 'string' || typeof meta.presetId !== 'string') return null
  const notes: ReviewNote[] = []
  for (const match of markdown.matchAll(/<!-- note: (.*?) -->/g)) {
    try {
      const value = JSON.parse(match[1]!) as Partial<ReviewNote>
      if (typeof value.id !== 'string' || typeof value.text !== 'string' || typeof value.createdAt !== 'string' || !isStatus(value.status)) continue
      notes.push({
        id: value.id, status: value.status, createdAt: value.createdAt, text: value.text,
        ...(typeof value.updatedAt === 'string' ? { updatedAt: value.updatedAt } : {}),
        ...(isReviewNoteKind(value.kind) ? { kind: value.kind } : {}),
        ...(typeof value.area === 'string' && value.area.trim() ? { area: value.area.trim().slice(0, REVIEW_NOTES_MAX_AREA) } : {}),
        ...(typeof value.screenshot === 'string' ? { screenshot: value.screenshot } : {}),
        ...(value.context && typeof value.context === 'object' ? { context: value.context } : {}),
        ...(typeof value.resolution === 'string' ? { resolution: value.resolution } : {}),
      })
    } catch { /* skip */ }
  }
  return { engine: meta.engine, presetId: meta.presetId, presetName: typeof meta.presetName === 'string' ? meta.presetName : meta.presetId, notes }
}

/** How a file's place reads: a preset by its name, a page or the whole app marked as the app. */
export const placeLabel = (file: ReviewNotesFile): string => file.engine === REVIEW_NOTES_APP_ENGINE ? `${file.presetName} (app)` : file.presetName

export interface ReviewNotesIndexEntry { fileName: string; file: ReviewNotesFile }

/** The index at the top of the folder: what is open, where, and how to work through it. */
export function renderReviewNotesIndex(entries: readonly ReviewNotesIndexEntry[]): string {
  const withOpen = entries.filter(entry => entry.file.notes.some(note => note.status === 'open'))
  const total = withOpen.reduce((sum, entry) => sum + entry.file.notes.filter(note => note.status === 'open').length, 0)
  const lines = [
    '# Review notes — index',
    '',
    'Temporary notes written in the running app (dev server only, never committed). One file per preset in this folder.',
    '',
    '**To work through them:** read this index, open each file with open notes, make the changes, then mark each one done with what was changed:',
    '',
    '```sh',
    'npm run review-notes -- list              # every open note, with its file and screenshot',
    'npm run review-notes -- done <id> "what was changed"',
    'npm run review-notes -- reopen <id>',
    '```',
    '',
    `## Open (${total})`,
    '',
  ]
  if (!withOpen.length) lines.push('Nothing open.', '')
  for (const { fileName, file } of withOpen) {
    const open = file.notes.filter(note => note.status === 'open')
    lines.push(`### ${placeLabel(file)} — ${open.length} open (\`${fileName}\`)`, '')
    for (const note of open) {
      const first = note.text.trim().split('\n')[0]!.slice(0, 120)
      lines.push(`- \`${note.id}\`${note.kind ? ` [${note.kind}]` : ''} ${first}${note.area ? ` (${note.area})` : ''}${note.screenshot ? ' 📎' : ''}`)
    }
    lines.push('')
  }
  const finished = entries.filter(entry => !withOpen.includes(entry))
  if (finished.length) lines.push('## No open notes', '', ...finished.map(({ fileName, file }) => `- ${placeLabel(file)} (\`${fileName}\`): ${file.notes.length} done`), '')
  return lines.join('\n')
}
