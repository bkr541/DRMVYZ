import type { ShaderDefinition, ShaderCategory, ValidationResult } from './shaderRegistryTypes'
import { ShaderDefinitionValidator } from './ShaderDefinitionValidator'

// ── ShaderRegistry ────────────────────────────────────────────────────────────

/**
 * Immutable metadata-only registry for GLSL shader scene definitions.
 *
 * The registry never instantiates WebGL resources — it stores GLSL source
 * strings and parameter schemas only.  The runtime reads definitions from
 * here at activation time to compile programs and allocate GPU resources.
 *
 * Ordering is deterministic: `getAll()` returns definitions in insertion
 * order (the JavaScript Map contract).
 */
export class ShaderRegistry {
  private readonly _defs = new Map<string, ShaderDefinition>()

  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a shader definition.
   *
   * @throws {Error} If the definition has a duplicate ID.
   * @throws {Error} If the definition fails schema validation.
   */
  register(def: ShaderDefinition): void {
    if (this._defs.has(def.id)) {
      throw new Error(
        `[ShaderRegistry] duplicate shader id "${def.id}" — each shader must have a unique id`,
      )
    }

    const result = ShaderDefinitionValidator.validate(def)
    if (!result.valid) {
      const summary = result.errors
        .map(err => `  • ${err.field}: ${err.message}`)
        .join('\n')
      throw new Error(
        `[ShaderRegistry] definition "${def.id}" failed validation:\n${summary}`,
      )
    }

    this._defs.set(def.id, Object.freeze({ ...def }) as ShaderDefinition)
  }

  /**
   * Remove a shader definition from the registry.
   * Does nothing if the id is not registered.
   */
  unregister(id: string): void {
    this._defs.delete(id)
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  get(id: string): ShaderDefinition | undefined {
    return this._defs.get(id)
  }

  has(id: string): boolean {
    return this._defs.has(id)
  }

  /** Return all registered definitions in insertion order. */
  getAll(): ShaderDefinition[] {
    return Array.from(this._defs.values())
  }

  /** Return definitions matching the given category, in insertion order. */
  getByCategory(category: ShaderCategory): ShaderDefinition[] {
    return this.getAll().filter(d => d.category === category)
  }

  /**
   * Return definitions that include the given tag, in insertion order.
   * The comparison is case-sensitive.
   */
  getByTag(tag: string): ShaderDefinition[] {
    return this.getAll().filter(d => d.tags?.includes(tag) ?? false)
  }

  // ── Validation ────────────────────────────────────────────────────────────

  /**
   * Re-validate every registered definition and return a map of
   * id → ValidationResult.  Useful for catching issues after programmatic
   * modification or for health-check endpoints.
   */
  validateAll(): Record<string, ValidationResult> {
    return ShaderDefinitionValidator.validateMany(this.getAll())
  }

  // ── Diagnostics ───────────────────────────────────────────────────────────

  get size(): number {
    return this._defs.size
  }
}
