import type { ShaderDefinition, ShaderParamValues } from '../registry/shaderRegistryTypes'
import { ShaderDefinitionValidator } from '../registry/ShaderDefinitionValidator'
import { shaderRegistry } from '../registry'

// ── Package format ────────────────────────────────────────────────────────────

export const PACKAGE_SCHEMA_VERSION = 1
export const PACKAGE_SCHEMA_ID      = 'drmvyz:shader-package:v1'

/** Maximum size of an embedded asset (4 MiB). */
const MAX_EMBEDDED_ASSET_BYTES = 4 * 1024 * 1024

/** Maximum number of render passes a package may declare. */
const MAX_PASS_COUNT = 16

/** Maximum texture dimension for embedded textures. */
const MAX_TEXTURE_DIMENSION = 4096

export interface ShaderPackagePreset {
  name:   string
  values: ShaderParamValues
}

export interface ShaderPackageTransitionMeta {
  supportedTypes:    string[]
  defaultDurationMs: number
}

export interface ShaderPackage {
  $schema:    string
  version:    number
  exportedAt: string
  exportedBy: string
  definition: ShaderDefinition
  presets?:   ShaderPackagePreset[]
  transitionMetadata?: ShaderPackageTransitionMeta
}

// ── Import result ─────────────────────────────────────────────────────────────

export type ImportResult =
  | { ok: true;  package: ShaderPackage; warnings: string[] }
  | { ok: false; errors: string[] }

// ── ShaderImportExport ────────────────────────────────────────────────────────

export class ShaderImportExport {
  // ── Export ────────────────────────────────────────────────────────────────

  /**
   * Serialize a shader definition to a versioned JSON package string.
   *
   * @param def      The definition to export.
   * @param presets  Optional list of presets to bundle with the package.
   */
  static export(
    def:     ShaderDefinition,
    opts: {
      presets?:            ShaderPackagePreset[]
      transitionMetadata?: ShaderPackageTransitionMeta
    } = {},
  ): string {
    const pkg: ShaderPackage = {
      $schema:    PACKAGE_SCHEMA_ID,
      version:    PACKAGE_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      exportedBy: 'DRMVYZ Shader Engine',
      definition: def,
    }
    if (opts.presets?.length)         pkg.presets            = opts.presets
    if (opts.transitionMetadata)      pkg.transitionMetadata = opts.transitionMetadata
    return JSON.stringify(pkg, null, 2)
  }

  // ── Import / parse ────────────────────────────────────────────────────────

  /**
   * Parse and validate a JSON string as a ShaderPackage.
   *
   * Validation rejects:
   *   - Invalid or missing `$schema` / `version`.
   *   - Missing or empty shader source.
   *   - Duplicate IDs (against the global shaderRegistry and optionally
   *     a caller-supplied set of existing user IDs).
   *   - Invalid parameter schemas.
   *   - Invalid pass dependencies.
   *   - Unsafe or unsupported texture declarations.
   *   - Oversized embedded assets.
   *   - Excessive pass count.
   *   - Excessive texture dimensions.
   *
   * Returns a discriminated union: `{ ok: true, package, warnings }` or
   * `{ ok: false, errors }`.
   *
   * @param json          Raw JSON string from the user.
   * @param existingIds   Set of user-scene IDs already registered (to detect
   *                      duplicates in the local library).
   */
  static import(json: string, existingIds: ReadonlySet<string> = new Set()): ImportResult {
    const errors:   string[] = []
    const warnings: string[] = []

    // ── Parse ──────────────────────────────────────────────────────────────
    let raw: unknown
    try {
      raw = JSON.parse(json)
    } catch {
      return { ok: false, errors: ['Invalid JSON — the file could not be parsed'] }
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, errors: ['Package must be a JSON object'] }
    }

    const obj = raw as Record<string, unknown>

    // ── Schema and version ─────────────────────────────────────────────────
    if (obj['$schema'] !== PACKAGE_SCHEMA_ID) {
      errors.push(`Unrecognized or missing $schema — expected "${PACKAGE_SCHEMA_ID}"`)
    }

    const version = typeof obj['version'] === 'number' ? obj['version'] : null
    if (version === null || !Number.isInteger(version) || version < 1 || version > PACKAGE_SCHEMA_VERSION) {
      errors.push(`Invalid or unsupported package version (got: ${obj['version']})`)
    }

    if (errors.length > 0) return { ok: false, errors }

    // ── Definition ─────────────────────────────────────────────────────────
    const defRaw = obj['definition']
    if (!defRaw || typeof defRaw !== 'object' || Array.isArray(defRaw)) {
      return { ok: false, errors: ['Missing or invalid "definition" field'] }
    }

    const def = defRaw as Record<string, unknown>

    // Validate with existing ShaderDefinitionValidator
    const defAsShaderDef = def as unknown as ShaderDefinition
    const validation = ShaderDefinitionValidator.validate(defAsShaderDef)
    if (!validation.valid) {
      for (const err of validation.errors) {
        errors.push(`definition.${err.field}: ${err.message}`)
      }
    }

    // ── Duplicate ID check ────────────────────────────────────────────────
    const id = typeof def['id'] === 'string' ? def['id'] : null
    if (id) {
      if (shaderRegistry.has(id)) {
        errors.push(`Scene ID "${id}" conflicts with a bundled scene — assign a new ID before importing`)
      } else if (existingIds.has(id)) {
        errors.push(`Scene ID "${id}" already exists in your library — assign a new ID before importing`)
      }
    }

    // ── Pass count check ──────────────────────────────────────────────────
    const passes = Array.isArray(def['passes']) ? def['passes'] as unknown[] : []
    if (passes.length > MAX_PASS_COUNT) {
      errors.push(`Excessive pass count (${passes.length}) — maximum allowed is ${MAX_PASS_COUNT}`)
    }

    // ── Texture dimension check ───────────────────────────────────────────
    const textureInputs = Array.isArray(def['textureInputs']) ? def['textureInputs'] as unknown[] : []
    for (const ti of textureInputs) {
      if (typeof ti === 'object' && ti !== null) {
        const t = ti as Record<string, unknown>
        const w = typeof t['width']  === 'number' ? t['width']  : null
        const h = typeof t['height'] === 'number' ? t['height'] : null
        if (w !== null && w > MAX_TEXTURE_DIMENSION) {
          errors.push(`Texture width ${w} exceeds maximum allowed dimension ${MAX_TEXTURE_DIMENSION}`)
        }
        if (h !== null && h > MAX_TEXTURE_DIMENSION) {
          errors.push(`Texture height ${h} exceeds maximum allowed dimension ${MAX_TEXTURE_DIMENSION}`)
        }
      }
    }

    // ── Oversized asset check ─────────────────────────────────────────────
    // Detect base64-embedded blobs in fragSrc or pass sources.
    const base64Pattern = /data:[^;]+;base64,([A-Za-z0-9+/=]+)/g
    const allSrcs = [
      typeof def['fragSrc'] === 'string' ? def['fragSrc'] : '',
      ...passes.map(p => (typeof p === 'object' && p !== null) ? String((p as Record<string, unknown>)['fragSrc'] ?? '') : ''),
    ].join('\n')

    let match: RegExpExecArray | null
    while ((match = base64Pattern.exec(allSrcs)) !== null) {
      const estimatedBytes = Math.ceil((match[1].length * 3) / 4)
      if (estimatedBytes > MAX_EMBEDDED_ASSET_BYTES) {
        errors.push(`Embedded asset (${(estimatedBytes / 1024 / 1024).toFixed(1)} MiB) exceeds the 4 MiB limit`)
      }
    }

    // ── No arbitrary JavaScript ───────────────────────────────────────────
    // GLSL source is plain string data — it never gets eval'd.
    // The importer never executes any string as code.

    if (errors.length > 0) return { ok: false, errors }

    // ── Warn on deprecated / unusual fields ──────────────────────────────
    if (typeof obj['legacyId'] === 'string') {
      warnings.push('Package contains deprecated "legacyId" field — it was ignored')
    }

    const pkg: ShaderPackage = {
      $schema:    String(obj['$schema'] ?? PACKAGE_SCHEMA_ID),
      version:    version!,
      exportedAt: typeof obj['exportedAt'] === 'string' ? obj['exportedAt'] : new Date().toISOString(),
      exportedBy: typeof obj['exportedBy'] === 'string' ? obj['exportedBy'] : 'unknown',
      definition: defAsShaderDef,
      presets:    Array.isArray(obj['presets']) ? obj['presets'] as ShaderPackagePreset[] : undefined,
      transitionMetadata: (obj['transitionMetadata'] && typeof obj['transitionMetadata'] === 'object')
        ? obj['transitionMetadata'] as ShaderPackageTransitionMeta
        : undefined,
    }

    return { ok: true, package: pkg, warnings }
  }

  // ── File helpers ──────────────────────────────────────────────────────────

  /** Suggest a filename for an exported package. */
  static suggestFilename(def: ShaderDefinition): string {
    const slug = def.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return `${slug}-shader.json`
  }

  /**
   * Trigger a file download of the serialized package in the browser.
   * No-op in non-browser environments.
   */
  static downloadPackage(def: ShaderDefinition, opts: Parameters<typeof ShaderImportExport.export>[1] = {}): void {
    if (typeof document === 'undefined') return
    const json = ShaderImportExport.export(def, opts)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = ShaderImportExport.suggestFilename(def)
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Read a File object and parse it as a shader package.
   * Returns a promise that resolves to an ImportResult.
   */
  static async importFile(
    file:        File,
    existingIds: ReadonlySet<string> = new Set(),
  ): Promise<ImportResult> {
    if (file.size > MAX_EMBEDDED_ASSET_BYTES * 2) {
      return { ok: false, errors: [`File too large (${(file.size / 1024 / 1024).toFixed(1)} MiB) — maximum is 8 MiB`] }
    }
    const text = await file.text()
    return ShaderImportExport.import(text, existingIds)
  }
}
