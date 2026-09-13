import type {
  Cinema2CapabilityId,
  Cinema2CapabilityRequirement,
  Cinema2NativePresetManifest,
  Cinema2ParameterConditionManifest,
  Cinema2ParameterExposure,
  Cinema2ParameterId,
  Cinema2ParameterRef,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_QUALITY_MODE_PARAMETER_ID } from '../parameters/Cinema2PerformanceParameters'
import type { Cinema2PresetDiagnostic } from './Cinema2PresetCompiler'

export type Cinema2FirstPartyPresetRole = 'foundation' | 'reference' | 'keeper'

export interface Cinema2FirstPartyPresetDeclaration {
  role: Cinema2FirstPartyPresetRole
  manifest: Readonly<Cinema2NativePresetManifest>
}

export interface Cinema2PresetAuthoringValidationResult {
  ok: boolean
  diagnostics: readonly Cinema2PresetDiagnostic[]
}

interface CapabilityUse {
  id: Cinema2CapabilityId
  requirement: Cinema2CapabilityRequirement['requirement'] | null
  path: string
}

/**
 * Tiny authoring helper for the first-party catalog. It deliberately carries no
 * compatibility state and does not alter the native preset manifest.
 */
export function defineCinema2FirstPartyPreset(
  declaration: Cinema2FirstPartyPresetDeclaration,
): Readonly<Cinema2FirstPartyPresetDeclaration> {
  return Object.freeze({ ...declaration })
}

/**
 * Additional production-authoring gate layered above the native compiler.
 * These rules codify conventions demonstrated by the current native reference
 * and keeper presets without expanding the runtime contract.
 */
export function validateCinema2PresetAuthoringConventions(
  declaration: Readonly<Cinema2FirstPartyPresetDeclaration>,
): Cinema2PresetAuthoringValidationResult {
  if (declaration.role === 'foundation') return { ok: true, diagnostics: Object.freeze([]) }

  const manifest = declaration.manifest
  const diagnostics: Cinema2PresetDiagnostic[] = []
  const topLevelCapabilities = new Map<Cinema2CapabilityId, Cinema2CapabilityRequirement>()

  for (const [index, capability] of (manifest.capabilities ?? []).entries()) {
    topLevelCapabilities.set(capability.id, capability)
    if (typeof capability.purpose !== 'string' || capability.purpose.trim().length === 0) {
      diagnostics.push(error(
        'CINEMA2_PRESET_AUTHORING_CAPABILITY_PURPOSE_REQUIRED',
        `First-party ${declaration.role} capability "${capability.id}" requires a short authored purpose.`,
        `$.capabilities[${index}].purpose`,
      ))
    }
  }

  const webgl2 = topLevelCapabilities.get('render.webgl2')
  if (webgl2?.requirement !== 'required') {
    diagnostics.push(error(
      'CINEMA2_PRESET_AUTHORING_WEBGL2_REQUIRED',
      `First-party ${declaration.role} presets must explicitly declare render.webgl2 as required.`,
      '$.capabilities',
    ))
  }

  for (const use of collectNestedCapabilityUses(manifest)) {
    const declared = topLevelCapabilities.get(use.id)
    if (!declared) {
      diagnostics.push(error(
        'CINEMA2_PRESET_AUTHORING_CAPABILITY_NOT_DECLARED',
        `Capability "${use.id}" is used by authored preset content but is not declared at the preset boundary.`,
        use.path,
      ))
      continue
    }
    if (use.requirement === 'required' && declared.requirement !== 'required') {
      diagnostics.push(error(
        'CINEMA2_PRESET_AUTHORING_CAPABILITY_REQUIREMENT_WEAKENED',
        `Capability "${use.id}" is required by nested authored content but only optional at the preset boundary.`,
        use.path,
      ))
    }
  }

  const consumers = collectParameterConsumers(manifest)
  for (const [index, parameter] of (manifest.parameters ?? []).entries()) {
    if (!isUserFacingParameter(parameter.exposure)) continue
    if (parameter.id === CINEMA2_QUALITY_MODE_PARAMETER_ID) continue
    if (parameter.type === 'media' && parameter.mediaSlot != null) continue
    if (consumers.has(parameter.id)) continue
    diagnostics.push(error(
      'CINEMA2_PRESET_AUTHORING_CONTROL_UNCONSUMED',
      `User-facing parameter "${parameter.id}" is not connected through a schema binding, control binding, choreography route, or authored target.`,
      `$.parameters[${index}]`,
    ))
  }

  return {
    ok: diagnostics.length === 0,
    diagnostics: Object.freeze(diagnostics.map(diagnostic => Object.freeze({ ...diagnostic }))),
  }
}

function collectNestedCapabilityUses(manifest: Readonly<Cinema2NativePresetManifest>): readonly CapabilityUse[] {
  const result: CapabilityUse[] = []
  const pushRequirements = (requirements: readonly Cinema2CapabilityRequirement[] | undefined, path: string) => {
    for (const [index, capability] of (requirements ?? []).entries()) {
      result.push({ id: capability.id, requirement: capability.requirement, path: `${path}[${index}]` })
    }
  }
  const pushConditions = (conditions: readonly Cinema2ParameterConditionManifest[] | undefined, path: string) => {
    for (const [index, condition] of (conditions ?? []).entries()) {
      if (condition.kind === 'capability-available') {
        result.push({ id: condition.capability, requirement: null, path: `${path}[${index}].capability` })
      }
    }
  }

  for (const [index, module] of (manifest.modules ?? []).entries()) {
    pushRequirements(module.capabilities, `$.modules[${index}].capabilities`)
  }
  for (const [index, parameter] of (manifest.parameters ?? []).entries()) {
    pushRequirements(parameter.capabilities, `$.parameters[${index}].capabilities`)
    pushConditions(parameter.visibleWhen, `$.parameters[${index}].visibleWhen`)
    pushConditions(parameter.enabledWhen, `$.parameters[${index}].enabledWhen`)
  }
  for (const [ruleIndex, rule] of (manifest.choreography?.rules ?? []).entries()) {
    if (rule.source.capability) {
      result.push({ id: rule.source.capability, requirement: null, path: `$.choreography.rules[${ruleIndex}].source.capability` })
    }
    for (const [conditionIndex, condition] of (rule.conditions ?? []).entries()) {
      if (condition.kind === 'capability') {
        result.push({
          id: condition.capability,
          requirement: null,
          path: `$.choreography.rules[${ruleIndex}].conditions[${conditionIndex}].capability`,
        })
      }
    }
  }

  const mediaCapabilities: Record<string, Cinema2CapabilityId> = {
    image: 'media.image',
    video: 'media.video',
    svg: 'media.svg',
  }
  for (const [slotIndex, slot] of (manifest.mediaSlots ?? []).entries()) {
    for (const [acceptIndex, kind] of slot.accepts.entries()) {
      result.push({
        id: mediaCapabilities[kind],
        requirement: null,
        path: `$.mediaSlots[${slotIndex}].accepts[${acceptIndex}]`,
      })
    }
  }

  return result
}

function collectParameterConsumers(manifest: Readonly<Cinema2NativePresetManifest>): ReadonlySet<Cinema2ParameterId> {
  const result = new Set<Cinema2ParameterId>()
  const addRef = (ref: Cinema2ParameterRef | undefined) => {
    if (ref) result.add(ref.$ref)
  }
  const addRecord = (record: Readonly<Record<string, Cinema2ParameterRef>> | undefined) => {
    for (const ref of Object.values(record ?? {})) addRef(ref)
  }
  const addConditionRefs = (conditions: readonly Cinema2ParameterConditionManifest[] | undefined) => {
    for (const condition of conditions ?? []) {
      if (condition.kind === 'parameter-equals' || condition.kind === 'parameter-not-equals') {
        result.add(condition.parameterId)
      }
    }
  }

  for (const parameter of manifest.parameters ?? []) {
    addConditionRefs(parameter.visibleWhen)
    addConditionRefs(parameter.enabledWhen)
  }
  for (const pass of manifest.render?.passes ?? []) addConditionRefs(pass.enabledWhen)

  for (const module of manifest.modules ?? []) {
    addRecord(module.parameterBindings)
    addRecord(module.actionBindings)
  }
  for (const effect of manifest.effects ?? []) {
    addRecord(effect.parameterBindings)
    addRecord(effect.actionBindings)
  }
  for (const camera of manifest.cameras ?? []) {
    for (const ref of Object.values(camera.controls ?? {})) addRef(ref)
  }
  for (const light of manifest.lighting?.lights ?? []) {
    for (const ref of Object.values(light.controls ?? {})) addRef(ref)
  }
  for (const ref of Object.values(manifest.environment?.controls ?? {})) addRef(ref)

  for (const rule of manifest.choreography?.rules ?? []) {
    addRef(rule.source.parameter)
    addRef(rule.enabledParameter)
    addRef(rule.strengthParameter)
    for (const action of rule.actions) {
      if (action.target.kind === 'parameter') addRef(action.target.ref)
    }
  }

  return result
}

function isUserFacingParameter(exposure: Cinema2ParameterExposure | undefined): boolean {
  return exposure !== 'hidden' && exposure !== 'diagnostic'
}

function error(code: string, message: string, path: string): Cinema2PresetDiagnostic {
  return { code, severity: 'error', message, path }
}
