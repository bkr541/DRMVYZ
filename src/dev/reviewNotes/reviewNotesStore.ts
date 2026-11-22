import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  REVIEW_NOTES_DIR, REVIEW_NOTES_MAX_TEXT, REVIEW_NOTES_SCREENSHOT_DIR, newReviewNoteId, parseReviewNotes, renderReviewNotesIndex, reviewNotesSlug, serializeReviewNotes,
  REVIEW_NOTES_MAX_AREA, type ReviewNote, type ReviewNoteKind, type ReviewNoteStatus, type ReviewNotesFile, type ReviewNotesIndexEntry,
} from './reviewNotesFormat.ts'

/** Reads and writes the review notes folder under a repository root. Used by the dev server and by the command line tool. */
export class ReviewNotesStore {
  private queue: Promise<unknown> = Promise.resolve()
  private readonly root: string
  constructor(root: string) { this.root = root }

  private get dir() { return join(this.root, REVIEW_NOTES_DIR) }
  private fileFor(engine: string, presetId: string) { return join(this.dir, `${reviewNotesSlug(engine, presetId)}.md`) }
  /** One write at a time, so two quick saves never overwrite each other. */
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work, work)
    this.queue = run.catch(() => undefined)
    return run
  }

  async read(engine: string, presetId: string): Promise<ReviewNotesFile | null> {
    try { return parseReviewNotes(await readFile(this.fileFor(engine, presetId), 'utf8')) } catch { return null }
  }

  async readAll(): Promise<ReviewNotesIndexEntry[]> {
    let names: string[] = []
    try { names = (await readdir(this.dir)).filter(name => name.endsWith('.md') && name !== 'INDEX.md').sort() } catch { return [] }
    const entries: ReviewNotesIndexEntry[] = []
    for (const fileName of names) {
      try { const file = parseReviewNotes(await readFile(join(this.dir, fileName), 'utf8')); if (file) entries.push({ fileName, file }) } catch { /* skip */ }
    }
    return entries
  }

  private async write(file: ReviewNotesFile): Promise<void> {
    await mkdir(this.dir, { recursive: true })
    const target = this.fileFor(file.engine, file.presetId), temp = `${target}.tmp`
    await writeFile(temp, serializeReviewNotes(file), 'utf8')
    await rename(temp, target)
    await this.writeIndex()
  }

  async writeIndex(): Promise<void> {
    await mkdir(this.dir, { recursive: true })
    await writeFile(join(this.dir, 'INDEX.md'), renderReviewNotesIndex(await this.readAll()), 'utf8')
  }

  add(input: { engine: string; presetId: string; presetName: string; text: string; kind?: ReviewNoteKind; area?: string; context?: Record<string, unknown>; screenshot?: { bytes: Buffer; extension: 'png' | 'webp' | 'jpg' } }): Promise<ReviewNotesFile> {
    return this.serial(async () => {
      const text = input.text.trim()
      if (!text) throw new Error('A note needs some text.')
      if (text.length > REVIEW_NOTES_MAX_TEXT) throw new Error('That note is too long.')
      const id = newReviewNoteId()
      const file = await this.read(input.engine, input.presetId) ?? { engine: input.engine, presetId: input.presetId, presetName: input.presetName, notes: [] }
      file.presetName = input.presetName || file.presetName
      const area = input.area?.trim().slice(0, REVIEW_NOTES_MAX_AREA)
      const note: ReviewNote = { id, status: 'open', createdAt: new Date().toISOString(), text, ...(input.kind ? { kind: input.kind } : {}), ...(area ? { area } : {}), ...(input.context ? { context: input.context } : {}) }
      if (input.screenshot) {
        await mkdir(join(this.root, REVIEW_NOTES_SCREENSHOT_DIR), { recursive: true })
        note.screenshot = `${REVIEW_NOTES_SCREENSHOT_DIR}/${id}.${input.screenshot.extension}`
        await writeFile(join(this.root, note.screenshot), input.screenshot.bytes)
      }
      file.notes.push(note)
      await this.write(file)
      return file
    })
  }

  setStatus(engine: string, presetId: string, id: string, status: ReviewNoteStatus, resolution?: string): Promise<ReviewNotesFile> {
    return this.serial(async () => {
      const file = await this.read(engine, presetId)
      const note = file?.notes.find(entry => entry.id === id)
      if (!file || !note) throw new Error(`No note ${id}.`)
      note.status = status; note.updatedAt = new Date().toISOString()
      if (status === 'done' && resolution?.trim()) note.resolution = resolution.trim().slice(0, REVIEW_NOTES_MAX_TEXT)
      if (status === 'open') delete note.resolution
      await this.write(file)
      return file
    })
  }

  /** Removes a note and its screenshot. A file with no notes left is removed too. */
  remove(engine: string, presetId: string, id: string): Promise<ReviewNotesFile | null> {
    return this.serial(async () => {
      const file = await this.read(engine, presetId)
      const note = file?.notes.find(entry => entry.id === id)
      if (!file || !note) throw new Error(`No note ${id}.`)
      file.notes = file.notes.filter(entry => entry.id !== id)
      if (note.screenshot) await rm(join(this.root, note.screenshot), { force: true })
      if (!file.notes.length) { await rm(this.fileFor(engine, presetId), { force: true }); await this.writeIndex(); return null }
      await this.write(file)
      return file
    })
  }

  /** Finds a note by id in any file (the command line tool only has the id). */
  async find(id: string): Promise<{ file: ReviewNotesFile; note: ReviewNote } | null> {
    for (const { file } of await this.readAll()) { const note = file.notes.find(entry => entry.id === id); if (note) return { file, note } }
    return null
  }
}
