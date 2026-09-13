import type {
  Cinema2EffectId,
  Cinema2EffectManifest,
  Cinema2EffectScope,
  Cinema2JsonValue,
  Cinema2ParameterId,
  Cinema2RenderQualityLevel,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import type {
  Cinema2FinalValueResolver,
  Cinema2TargetHandle,
} from '../parameters/Cinema2TargetRuntime'
import type { Cinema2CompiledPresetPlan } from '../presets/Cinema2PresetCompiler'
import type {
  Cinema2EffectDiagnostic,
  Cinema2EffectInstance,
  Cinema2EffectRuntimeSnapshot,
  Cinema2EffectRuntimeStatus,
} from './Cinema2EffectContracts'
import type { Cinema2EffectRegistry } from './Cinema2EffectRegistry'
import type { Cinema2HistoryService } from '../runtime/Cinema2HistoryService'

export interface Cinema2EffectExecutionContext {
  frame: Readonly<Cinema2ModuleFrameReadContext>
  input: Readonly<{ texture: WebGLTexture; width: number; height: number }>
  target: WebGLFramebuffer | null
  width: number
  height: number
}

export type Cinema2EffectExecutionResult = 'applied' | 'bypassed'

interface EffectRecord {
  effect: Readonly<Cinema2EffectManifest>
  status: Cinema2EffectRuntimeStatus
  instance: Cinema2EffectInstance | null
  targets: ReadonlyMap<string, Readonly<Cinema2TargetHandle>>
  diagnostics: Cinema2EffectDiagnostic[]
}

const QUALITY_ORDER = Object.freeze({ low: 0, medium: 1, high: 2 } as const)

/**
 * Engine-owned lifecycle host for reusable post-processing instances. It owns
 * effect implementation creation/disposal while authored values continue to
 * resolve through the canonical target runtime.
 */
export class Cinema2EffectRuntime {
  private readonly records = new Map<Cinema2EffectId, EffectRecord>()
  private disposed = false

  constructor(
    private readonly gl: WebGL2RenderingContext,
    plan: Readonly<Cinema2CompiledPresetPlan>,
    private readonly resolver: Cinema2FinalValueResolver,
    private readonly registry: Cinema2EffectRegistry,
    private readonly quality: Cinema2RenderQualityLevel,
    private readonly history: Cinema2HistoryService,
  ) {
    const targetsByEffect = indexEffectTargets(plan.targets.targets)
    const ordered = [...(plan.manifest.effects ?? [])].sort(compareEffects)
    for (const effect of ordered) {
      this.records.set(effect.id, {
        effect,
        status: 'inactive',
        instance: null,
        targets: targetsByEffect.get(effect.id) ?? new Map(),
        diagnostics: [],
      })
    }
  }

  execute(effectId: Cinema2EffectId, context: Readonly<Cinema2EffectExecutionContext>): Cinema2EffectExecutionResult {
    if (this.disposed) return 'bypassed'
    const record = this.records.get(effectId)
    if (!record) return 'bypassed'

    const enabledValue = this.resolveValue(record, 'enabled', record.effect.enabled ?? true)
    if (typeof enabledValue !== 'boolean') {
      this.failRecord(record, 'CINEMA2_EFFECT_ENABLED_RESOLUTION_FAILED', 'Effect enabled state could not be resolved as a boolean.')
      return 'bypassed'
    }
    if (!enabledValue || !this.qualityAllows(record.effect)) {
      this.retireRecord(record, 'inactive')
      return 'bypassed'
    }

    const authoredMix = record.effect.parameters?.mix
    const mixValue = this.resolveValue(record, 'mix', typeof authoredMix === 'number' ? authoredMix : 1)
    if (typeof mixValue !== 'number' || !Number.isFinite(mixValue)) {
      this.failRecord(record, 'CINEMA2_EFFECT_MIX_RESOLUTION_FAILED', 'Effect mix could not be resolved as a finite number.')
      return 'bypassed'
    }
    if (mixValue <= 0) {
      this.retireRecord(record, 'inactive')
      return 'bypassed'
    }

    if (record.status === 'failed') return 'bypassed'
    if (!record.instance && !this.activateRecord(record)) return 'bypassed'

    const mix = clamp01(mixValue)
    const parameters: Record<string, Cinema2JsonValue> = { mix }
    for (const [property, authored] of Object.entries(record.effect.parameters ?? {})) {
      if (property === 'mix') continue
      const resolved = this.resolveValue(record, property, authored)
      if (resolved === undefined) {
        this.failRecord(record, 'CINEMA2_EFFECT_PARAMETER_RESOLUTION_FAILED', `Effect parameter "${property}" could not be resolved.`)
        return 'bypassed'
      }
      parameters[property] = resolved
    }

    try {
      record.instance!.render({ ...context, mix, parameters: Object.freeze(parameters) })
      return 'applied'
    } catch (error) {
      this.failRecord(record, 'CINEMA2_EFFECT_RENDER_FAILED', `Effect render failed: ${errorMessage(error)}`)
      return 'bypassed'
    }
  }


  dispatchParameterAction(parameterId: Cinema2ParameterId, eventId: string): number {
    if (this.disposed) return 0
    let dispatched = 0
    for (const record of this.records.values()) {
      if (!record.instance) continue
      for (const [action, ref] of Object.entries(record.effect.actionBindings ?? {})) {
        if (ref.$ref !== parameterId) continue
        if (!record.instance.handleAction) continue
        try {
          record.instance.handleAction(action, eventId)
          dispatched += 1
        } catch (error) {
          this.failRecord(record, 'CINEMA2_EFFECT_ACTION_FAILED', `Effect action "${action}" failed: ${errorMessage(error)}`)
        }
      }
    }
    return dispatched
  }

  handleContextLost(): void {
    if (this.disposed) return
    for (const record of this.records.values()) this.retireRecord(record, 'inactive')
  }

  handleContextRestored(): void {
    // Instances are intentionally recreated lazily on the next eligible frame.
  }

  getOrderedEffectIds(scope?: Cinema2EffectScope): readonly Cinema2EffectId[] {
    return Object.freeze([...this.records.values()]
      .filter(record => scope == null || (record.effect.scope ?? 'output') === scope)
      .map(record => record.effect.id))
  }

  getSnapshot(): Readonly<Cinema2EffectRuntimeSnapshot> {
    const effects = [...this.records.values()].map(record => Object.freeze({
      effectId: record.effect.id,
      typeId: record.effect.typeId,
      status: record.status,
      order: record.effect.order ?? 0,
      scope: record.effect.scope ?? 'output',
      quality: record.effect.quality == null ? null : Object.freeze({ ...record.effect.quality }),
      diagnostics: Object.freeze(record.diagnostics.map(diagnostic => Object.freeze({ ...diagnostic }))),
    }))
    return Object.freeze({
      activeEffectCount: effects.filter(effect => effect.status === 'active').length,
      failedEffectCount: effects.filter(effect => effect.status === 'failed').length,
      effects: Object.freeze(effects),
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const record of this.records.values()) this.retireRecord(record, 'disposed')
  }

  private activateRecord(record: EffectRecord): boolean {
    const definition = this.registry.get(record.effect.typeId, record.effect.version)
    if (!definition) {
      this.failRecord(record, 'CINEMA2_EFFECT_TYPE_VERSION_UNAVAILABLE', `No effect implementation is registered for "${record.effect.typeId}" version ${record.effect.version}.`)
      return false
    }
    record.diagnostics = []
    try {
      record.instance = definition.create({ gl: this.gl, effect: record.effect, history: this.history })
      record.status = 'active'
      return true
    } catch (error) {
      this.failRecord(record, 'CINEMA2_EFFECT_CREATE_FAILED', `Effect creation failed: ${errorMessage(error)}`)
      return false
    }
  }

  private failRecord(record: EffectRecord, code: string, message: string): void {
    record.diagnostics.push({ code, message, path: `effect.${record.effect.id}`, effectId: record.effect.id })
    this.retireRecord(record, 'failed')
  }

  private retireRecord(record: EffectRecord, nextStatus: Cinema2EffectRuntimeStatus): void {
    if (record.instance) {
      try {
        record.instance.dispose()
      } catch (error) {
        record.diagnostics.push({
          code: 'CINEMA2_EFFECT_DISPOSE_FAILED',
          message: `Effect dispose failed: ${errorMessage(error)}`,
          path: `effect.${record.effect.id}`,
          effectId: record.effect.id,
        })
      }
    }
    record.instance = null
    record.status = nextStatus
  }

  private qualityAllows(effect: Readonly<Cinema2EffectManifest>): boolean {
    const level = QUALITY_ORDER[this.quality]
    if (effect.quality?.min && level < QUALITY_ORDER[effect.quality.min]) return false
    if (effect.quality?.max && level > QUALITY_ORDER[effect.quality.max]) return false
    return true
  }

  private resolveValue(record: EffectRecord, property: string, fallback: Cinema2JsonValue): Cinema2JsonValue | undefined {
    const target = record.targets.get(property)
    if (!target) return cloneJson(fallback)
    const resolved = this.resolver.resolve(target.id)
    if (!resolved.ok || resolved.value === undefined) {
      record.diagnostics.push(...resolved.diagnostics.map(diagnostic => ({
        code: diagnostic.code,
        message: diagnostic.message,
        path: diagnostic.path,
        effectId: record.effect.id,
      })))
      return undefined
    }
    return cloneJson(resolved.value)
  }
}

function indexEffectTargets(
  targets: readonly Readonly<Cinema2TargetHandle>[],
): Map<Cinema2EffectId, Map<string, Readonly<Cinema2TargetHandle>>> {
  const result = new Map<Cinema2EffectId, Map<string, Readonly<Cinema2TargetHandle>>>()
  for (const target of targets) {
    if (target.kind !== 'effect') continue
    const effectId = target.ownerId as Cinema2EffectId
    const properties = result.get(effectId) ?? new Map<string, Readonly<Cinema2TargetHandle>>()
    properties.set(target.property, target)
    result.set(effectId, properties)
  }
  return result
}

function compareEffects(left: Readonly<Cinema2EffectManifest>, right: Readonly<Cinema2EffectManifest>): number {
  const leftScope = left.scope ?? 'output'
  const rightScope = right.scope ?? 'output'
  return compareStrings(leftScope, rightScope)
    || (left.order ?? 0) - (right.order ?? 0)
    || compareStrings(left.id, right.id)
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function cloneJson<T extends Cinema2JsonValue>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
