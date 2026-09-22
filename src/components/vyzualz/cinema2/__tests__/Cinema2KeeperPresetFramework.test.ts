import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import {
  CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS,
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  Cinema2ModuleRegistry,
  Cinema2ParameterState,
  Cinema2PresetRegistry,
  Cinema2Runtime,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  createCinema2DesignParentGroupModel,
  createCinema2InspectorModel,
  validateCinema2PresetAuthoringConventions,
  type Cinema2FirstPartyPresetDeclaration,
  type Cinema2ModuleId,
  type Cinema2ModuleTypeId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
} from '..'

const FIXTURE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.next-keeper-fixture')
const FIXTURE_MODULE_ID = cinema2StableId<Cinema2ModuleId>('next-keeper-module')
const FIXTURE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('next-keeper-module-type')
const FIXTURE_GAIN_ID = cinema2StableId<Cinema2ParameterId>('next-keeper-gain')

function nextKeeperManifest(): Cinema2NativePresetManifest {
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
    schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: FIXTURE_PRESET_ID,
    revision: 1,
    metadata: { name: 'Next Keeper Fixture', tags: ['keeper'] },
    capabilities: [{
      id: 'render.webgl2',
      requirement: 'required',
      purpose: 'Native Cinema 2.0 output.',
    }],
    parameters: [{
      id: FIXTURE_GAIN_ID,
      label: 'Gain',
      type: 'float',
      defaultValue: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      section: 'Design',
      group: 'Fixture',
      designParentGroup: 'design',
      exposure: 'primary',
      persistence: 'preset',
      reset: 'authored-default',
    }],
    modules: [{
      id: FIXTURE_MODULE_ID,
      typeId: FIXTURE_MODULE_TYPE_ID,
      version: 1,
      parameters: { gain: 0.5 },
      parameterBindings: { gain: cinema2Ref(FIXTURE_GAIN_ID) },
    }],
  }
}

function keeperDeclaration(manifest = nextKeeperManifest()): Cinema2FirstPartyPresetDeclaration {
  return { role: 'keeper', manifest }
}

class FakeCanvas extends EventTarget {
  width = 300
  height = 150
  readonly getContext: ReturnType<typeof vi.fn>

  constructor(gl: WebGL2RenderingContext | null) {
    super()
    this.getContext = vi.fn(() => gl)
  }
}

describe('Cinema 2.0 keeper preset migration framework', () => {
  it('keeps every first-party declaration behind the authoring gate and native compiler', () => {
    const registry = new Cinema2PresetRegistry()

    for (const declaration of CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS) {
      expect(validateCinema2PresetAuthoringConventions(declaration), declaration.manifest.id).toMatchObject({ ok: true })
      expect(registry.register(declaration.manifest), declaration.manifest.id).toMatchObject({ ok: true })
    }

    expect(registry.list().map(manifest => manifest.id)).toEqual(
      [...CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS]
        .map(declaration => declaration.manifest.id)
        .sort((left, right) => left.localeCompare(right)),
    )
  })

  it('catalog-drives the keeper Design-parent completeness guard without constraining reference or foundation manifests', () => {
    const keepers = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.filter(declaration => declaration.role === 'keeper')
    expect(keepers.length).toBeGreaterThan(0)

    for (const declaration of keepers) {
      const result = validateCinema2PresetAuthoringConventions(declaration)
      expect(
        result.diagnostics.filter(diagnostic => diagnostic.code === 'CINEMA2_PRESET_AUTHORING_DESIGN_PARENT_REQUIRED' || diagnostic.code === 'CINEMA2_PRESET_AUTHORING_DESIGN_PARENT_INVALID'),
        declaration.manifest.id,
      ).toEqual([])
    }
  })

  it('rejects undeclared nested capabilities and exposed controls that bypass schema bindings', () => {
    const missingCapability = nextKeeperManifest()
    missingCapability.parameters = [{
      ...missingCapability.parameters![0],
      capabilities: [{ id: 'music.drop', requirement: 'optional' }],
    }]
    const capabilityResult = validateCinema2PresetAuthoringConventions(keeperDeclaration(missingCapability))
    expect(capabilityResult.ok).toBe(false)
    expect(capabilityResult.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'CINEMA2_PRESET_AUTHORING_CAPABILITY_NOT_DECLARED',
        path: '$.parameters[0].capabilities[0]',
      }),
    ]))

    const unconsumedControl = nextKeeperManifest()
    unconsumedControl.modules = []
    const controlResult = validateCinema2PresetAuthoringConventions(keeperDeclaration(unconsumedControl))
    expect(controlResult.ok).toBe(false)
    expect(controlResult.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'CINEMA2_PRESET_AUTHORING_CONTROL_UNCONSUMED',
        path: '$.parameters[0]',
      }),
    ]))
  })

  it('rejects a keeper Design control with a missing or invalid canonical parent classification', () => {
    const missingParent = nextKeeperManifest()
    missingParent.parameters = [{ ...missingParent.parameters![0], designParentGroup: undefined }]
    const missingResult = validateCinema2PresetAuthoringConventions(keeperDeclaration(missingParent))
    expect(missingResult.ok).toBe(false)
    expect(missingResult.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'CINEMA2_PRESET_AUTHORING_DESIGN_PARENT_REQUIRED',
        path: '$.parameters[0].designParentGroup',
        message: expect.stringContaining(String(FIXTURE_GAIN_ID)),
      }),
    ]))

    const invalidParent = nextKeeperManifest()
    invalidParent.parameters = [{ ...invalidParent.parameters![0], designParentGroup: 'not-a-parent' as never }]
    const invalidResult = validateCinema2PresetAuthoringConventions(keeperDeclaration(invalidParent))
    expect(invalidResult.ok).toBe(false)
    expect(invalidResult.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'CINEMA2_PRESET_AUTHORING_DESIGN_PARENT_INVALID',
        path: '$.parameters[0].designParentGroup',
        message: expect.stringContaining('not-a-parent'),
      }),
    ]))
  })

  it('lets a new simple keeper register, appear in the generic Inspector, activate through the production runtime service, and retire tracked resources', () => {
    const manifest = nextKeeperManifest()
    expect(validateCinema2PresetAuthoringConventions(keeperDeclaration(manifest))).toMatchObject({ ok: true })

    const presetRegistry = new Cinema2PresetRegistry()
    expect(presetRegistry.register(manifest)).toMatchObject({ ok: true })
    const compilation = presetRegistry.compile(manifest.id, { availableCapabilities: ['render.webgl2'] })
    expect(compilation.ok).toBe(true)
    if (!compilation.ok) throw new Error('Expected keeper fixture to compile')

    const parameterState = new Cinema2ParameterState(compilation.plan.parameters)
    const parents = createCinema2DesignParentGroupModel(compilation.plan, parameterState.getSnapshot())
    expect(parents.flatMap(parent => [
      ...parent.controls,
      ...parent.groups.flatMap(group => group.controls),
    ]).map(control => control.definition.id)).toContain(FIXTURE_GAIN_ID)
    expect(createCinema2InspectorModel(compilation.plan, parameterState.getSnapshot(), 'design')).toEqual([])

    const moduleRegistry = new Cinema2ModuleRegistry()
    expect(moduleRegistry.register({
      typeId: FIXTURE_MODULE_TYPE_ID,
      version: 1,
      create: context => {
        let ownerGl: WebGL2RenderingContext | null = null
        context.resources.acquire(
          'fixture-buffer',
          'buffer',
          gl => {
            ownerGl = gl
            return gl.createBuffer()
          },
          buffer => {
            if (buffer) ownerGl?.deleteBuffer(buffer)
          },
        )
        return { lifecycle: { update: () => {}, dispose: () => {} } }
      },
    })).toMatchObject({ ok: true })

    const gl = createCinemaMockWebGL()
    const created = Cinema2Runtime.create(new FakeCanvas(gl) as unknown as HTMLCanvasElement, {
      presetId: manifest.id,
      presetRegistry,
      moduleRegistry,
      requestAnimationFrame: vi.fn(() => 1),
      cancelAnimationFrame: vi.fn(),
    })
    expect(created.runtime).not.toBeNull()
    if (!created.runtime) throw new Error(created.error)

    expect(created.runtime.getModuleRuntimeSnapshot()).toMatchObject({
      activeModuleCount: 1,
      activeResourceLeaseCount: 1,
    })
    expect(gl.__calls.createdBuffers).toBe(1)

    created.runtime.dispose()
    expect(created.runtime.getModuleRuntimeSnapshot()).toMatchObject({
      activeModuleCount: 0,
      activeResourceLeaseCount: 0,
    })
    expect(gl.__calls.deletedBuffers).toBe(1)
  })
})
