import type { ShaderDefinition, ShaderCategory } from '../registry/shaderRegistryTypes'
import { shaderRegistry } from '../registry'
import { migrateLegacyReactorSceneId } from '../scenes/reactorMigration'

// ── Library entry ─────────────────────────────────────────────────────────────

export interface ShaderLibraryEntry {
  definition:    ShaderDefinition
  /** True for scenes that ship with the app; false for user-created scenes. */
  bundled:       boolean
  /** User's favorite flag. */
  favorite:      boolean
  /** Collection names this entry belongs to. */
  collections:   string[]
  /** ISO 8601 timestamp of last use; null if never used. */
  lastUsedAt:    string | null
  /** ISO 8601 timestamp of creation (for user scenes). */
  createdAt:     string | null
  /** Whether a thumbnail has been cached. */
  hasThumbnail:  boolean
}

// ── Search and filter options ─────────────────────────────────────────────────

export interface ShaderSearchOptions {
  query?:      string
  category?:   ShaderCategory
  tag?:        string
  collection?: string
  favoritesOnly?: boolean
  bundledOnly?:   boolean
  userOnly?:      boolean
}

// ── ShaderLibrary ─────────────────────────────────────────────────────────────

/**
 * Pure logic layer for the shader scene library.
 *
 * Combines bundled scenes (from shaderRegistry) with user scenes
 * (provided externally by ShaderLibraryStore) and provides search,
 * filter, favorites, collections, and recently-used functionality.
 *
 * Stateless: it reads from the registry and accepts user-scene state as
 * constructor arguments.  The store owns persistence; this class owns logic.
 */
export class ShaderLibrary {
  constructor(
    private readonly _userDefs:    ReadonlyMap<string, ShaderDefinition>,
    private readonly _favorites:   ReadonlySet<string>,
    private readonly _collections: ReadonlyMap<string, ReadonlySet<string>>,
    private readonly _recentIds:   readonly string[],
    private readonly _thumbnails:  ReadonlySet<string>,
  ) {}

  // ── Bundled scenes ─────────────────────────────────────────────────────────

  getBundled(): ShaderDefinition[] {
    return shaderRegistry.getAll().filter(d => !this._isDevScene(d))
  }

  isBundled(id: string): boolean {
    return shaderRegistry.has(migrateLegacyReactorSceneId(id) ?? id)
  }

  // ── All entries ────────────────────────────────────────────────────────────

  getAll(opts: ShaderSearchOptions = {}): ShaderLibraryEntry[] {
    const entries: ShaderLibraryEntry[] = [
      ...this.getBundled().map(d => this._toEntry(d, true)),
      ...Array.from(this._userDefs.values()).map(d => this._toEntry(d, false)),
    ]
    return this._filter(entries, opts)
  }

  getEntry(id: string): ShaderLibraryEntry | null {
    const targetId = migrateLegacyReactorSceneId(id) ?? id
    const bundled = shaderRegistry.get(targetId)
    if (bundled && !this._isDevScene(bundled)) return this._toEntry(bundled, true)
    const user = this._userDefs.get(targetId)
    if (user) return this._toEntry(user, false)
    return null
  }

  // ── Recently used ─────────────────────────────────────────────────────────

  getRecentlyUsed(limit = 20): ShaderLibraryEntry[] {
    const results: ShaderLibraryEntry[] = []
    for (const id of this._recentIds.slice(0, limit)) {
      const entry = this.getEntry(id)
      if (entry) results.push(entry)
    }
    return results
  }

  // ── Categories / tags ─────────────────────────────────────────────────────

  getCategories(): ShaderCategory[] {
    const seen = new Set<ShaderCategory>()
    for (const e of this.getAll()) seen.add(e.definition.category)
    return Array.from(seen)
  }

  getTags(): string[] {
    const seen = new Set<string>()
    for (const e of this.getAll()) {
      for (const t of e.definition.tags ?? []) {
        if (t !== 'dev' && t !== 'internal') seen.add(t)
      }
    }
    return Array.from(seen).sort()
  }

  getCollectionNames(): string[] {
    return Array.from(this._collections.keys()).sort()
  }

  // ── Search ────────────────────────────────────────────────────────────────

  search(query: string): ShaderLibraryEntry[] {
    return this.getAll({ query })
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _toEntry(def: ShaderDefinition, bundled: boolean): ShaderLibraryEntry {
    const collectionNames: string[] = []
    for (const [name, ids] of this._collections) {
      if (ids.has(def.id)) collectionNames.push(name)
    }

    const recentIdx = this._recentIds.indexOf(def.id)
    return {
      definition:   def,
      bundled,
      favorite:     this._favorites.has(def.id),
      collections:  collectionNames,
      lastUsedAt:   recentIdx >= 0 ? null : null, // timestamps tracked in store
      createdAt:    null,
      hasThumbnail: this._thumbnails.has(def.id),
    }
  }

  private _filter(entries: ShaderLibraryEntry[], opts: ShaderSearchOptions): ShaderLibraryEntry[] {
    let result = entries

    if (opts.bundledOnly) result = result.filter(e => e.bundled)
    if (opts.userOnly)    result = result.filter(e => !e.bundled)
    if (opts.favoritesOnly) result = result.filter(e => e.favorite)

    if (opts.category) {
      result = result.filter(e => e.definition.category === opts.category)
    }

    if (opts.tag) {
      result = result.filter(e => e.definition.tags?.includes(opts.tag!) ?? false)
    }

    if (opts.collection) {
      const ids = this._collections.get(opts.collection) ?? new Set<string>()
      result = result.filter(e => ids.has(e.definition.id))
    }

    if (opts.query) {
      const q = opts.query.toLowerCase()
      result = result.filter(e => {
        const d = e.definition
        return (
          d.name.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          (d.tags ?? []).some(t => t.toLowerCase().includes(q)) ||
          d.category.toLowerCase().includes(q)
        )
      })
    }

    return result
  }

  private _isDevScene(def: ShaderDefinition): boolean {
    return def.tags?.includes('dev') === true || def.tags?.includes('internal') === true
  }
}
