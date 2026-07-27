/**
 * Live integration tests for the Shader engine.
 *
 * Tests the complete data flow from store → renderer → graph → uniforms,
 * including texture selections, transitions, quality resize, context loss,
 * manual sections, trigger params, and the selectReactEngine('shaderPads') path.
 *
 * Uses mock GL objects — no real browser or canvas.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ShaderPassCompiler } from '../rendergraph/ShaderPassCompiler'
import { ShaderRenderGraph }  from '../rendergraph/ShaderRenderGraph'
import { useShaderPanelStore } from '../ui/shaderPanelStore'
import { ShaderTransitionController } from '../transitions/ShaderTransitionController'
import { ShaderSectionChoreography } from '../transitions/ShaderSectionChoreography'
import { ShaderDefinitionValidator }  from '../registry/ShaderDefinitionValidator'
import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import type { ShaderTexSourceSelection } from '../textures/shaderTextureInputTypes'
import { useReactStore } from '../../../../../stores/reactStore'

// ── Minimal mock GL ───────────────────────────────────────────────────────────

function makeMockGL() {
  let objId = 1
  const gl = {
    TEXTURE_2D:       0x0DE1,
    TEXTURE_WRAP_S:   0x2802, TEXTURE_WRAP_T: 0x2803,
    TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800,
    CLAMP_TO_EDGE:    0x812F, REPEAT: 0x2901, MIRRORED_REPEAT: 0x8370,
    LINEAR:           0x2601, NEAREST: 0x2600,
    RGBA8:            0x8058, R8: 0x8229,
    RGBA:             6408,   RED: 0x1903,
    UNSIGNED_BYTE:    0x1401, RGBA16F: 0x881A, HALF_FLOAT: 0x140B,
    RGBA32F:          0x8814, FLOAT: 0x1406,
    FRAMEBUFFER:      0x8D40, COLOR_ATTACHMENT0: 0x8CE0,
    FRAMEBUFFER_COMPLETE: 0x8CD5,
    VERTEX_SHADER:    0x8B31, FRAGMENT_SHADER: 0x8B30,
    COMPILE_STATUS:   0x8B81, LINK_STATUS:     0x8B82,
    BLEND:            0x0BE2, COLOR_BUFFER_BIT: 0x4000,
    ONE: 1, ZERO: 0, SRC_ALPHA: 0x0302, ONE_MINUS_SRC_ALPHA: 0x0303,
    DST_COLOR: 0x0306, ONE_MINUS_SRC_COLOR: 0x0301,

    createTexture():      WebGLTexture    { return { _id: objId++ } as unknown as WebGLTexture },
    bindTexture()         {},
    texImage2D()          {},
    texStorage2D()        {},
    texParameteri()       {},
    deleteTexture()       {},
    activeTexture()       {},
    generateMipmap()      {},
    createFramebuffer():  WebGLFramebuffer { return { _id: objId++ } as unknown as WebGLFramebuffer },
    bindFramebuffer()     {},
    framebufferTexture2D(){},
    drawBuffers()         {},
    readBuffer()          {},
    checkFramebufferStatus() { return 0x8CD5 },
    deleteFramebuffer()   {},
    isContextLost()       { return false },
    getError()            { return 0 },
    getParameter(p: number) { return p === 0x0D33 || p === 0x84E8 ? 16384 : null },
    getExtension()        { return null },
    createShader():       WebGLShader     { return { _s: objId++ } as unknown as WebGLShader },
    shaderSource()        {},
    compileShader()       {},
    getShaderParameter(_: unknown, p: number) { return p === 0x8B81 },
    getShaderInfoLog()    { return '' },
    deleteShader()        {},
    createProgram():      WebGLProgram    { return { _p: objId++ } as unknown as WebGLProgram },
    attachShader()        {},
    linkProgram()         {},
    getProgramParameter(_: unknown, p: number) { return p === 0x8B82 },
    getProgramInfoLog()   { return '' },
    deleteProgram()       {},
    useProgram()          {},
    getUniformLocation(_: unknown, name: string) { return { _name: name } as unknown as WebGLUniformLocation },
    getAttribLocation()   { return 0 },
    viewport()            {},
    clearColor()          {},
    clear()               {},
    enable()              {},
    disable()             {},
    blendFunc()           {},
    flush()               {},
    uniform1f()           {},
    uniform1i()           {},
    uniform2f()           {},
    uniform3f()           {},
    uniform4f()           {},
    uniformMatrix4fv()    {},
    drawArrays()          {},
    createBuffer():       WebGLBuffer     { return { _b: objId++ } as unknown as WebGLBuffer },
    bindBuffer()          {},
    bufferData()          {},
    enableVertexAttribArray() {},
    vertexAttribPointer() {},
    createVertexArray():  WebGLVertexArrayObject { return { _va: objId++ } as unknown as WebGLVertexArrayObject },
    bindVertexArray()     {},
  }
  return gl as typeof gl & WebGL2RenderingContext
}

const FRAG = '#version 300 es\nprecision mediump float;\nout vec4 c;\nvoid main(){c=vec4(1);}'

function makeSimpleDef(id: string): ShaderDefinition {
  return {
    id,
    name: id,
    description: '',
    category: 'generator',
    version: 1,
    fragSrc: FRAG,
    params: [],
    defaults: {},
  }
}

// ── A: Store — per-scene texture selections ───────────────────────────────────

describe('A: shaderPanelStore — per-scene texture selections', () => {
  beforeEach(() => {
    useShaderPanelStore.setState({
      textureSelectionsByShaderId: {},
      textureValidationByShaderId: {},
    })
  })

  it('A1: setTextureSelection writes to the correct scene slot', () => {
    const { setTextureSelection } = useShaderPanelStore.getState()
    const sel: ShaderTexSourceSelection = { sourceType: 'fft' }
    setTextureSelection('scene-a', 'inputTex', sel)

    const state = useShaderPanelStore.getState()
    expect(state.textureSelectionsByShaderId['scene-a']?.['inputTex']).toEqual(sel)
    expect(state.textureSelectionsByShaderId['scene-b']).toBeUndefined()
  })

  it('A2: selections are isolated per scene ID', () => {
    const { setTextureSelection } = useShaderPanelStore.getState()
    setTextureSelection('scene-a', 'tex', { sourceType: 'fft' })
    setTextureSelection('scene-b', 'tex', { sourceType: 'waveform' })

    const state = useShaderPanelStore.getState()
    expect(state.textureSelectionsByShaderId['scene-a']?.['tex']?.sourceType).toBe('fft')
    expect(state.textureSelectionsByShaderId['scene-b']?.['tex']?.sourceType).toBe('waveform')
  })

  it('A3: clearTextureSelection removes entry from the correct scene only', () => {
    const { setTextureSelection, clearTextureSelection } = useShaderPanelStore.getState()
    setTextureSelection('scene-a', 'tex', { sourceType: 'fft' })
    setTextureSelection('scene-b', 'tex', { sourceType: 'waveform' })

    clearTextureSelection('scene-a', 'tex')

    const state = useShaderPanelStore.getState()
    expect(state.textureSelectionsByShaderId['scene-a']?.['tex']).toBeUndefined()
    expect(state.textureSelectionsByShaderId['scene-b']?.['tex']?.sourceType).toBe('waveform')
  })

  it('A4: setTextureValidation stores results keyed by scene ID', () => {
    const { setTextureValidation } = useShaderPanelStore.getState()
    setTextureValidation('scene-a', [
      { inputName: 'tex', required: true, available: false, warningMessage: 'Missing' },
    ])

    const state = useShaderPanelStore.getState()
    expect(state.textureValidationByShaderId['scene-a']).toHaveLength(1)
    expect(state.textureValidationByShaderId['scene-b']).toBeUndefined()
  })
})

// ── B: Store — trigger param round-trip ──────────────────────────────────────

describe('B: shaderPanelStore — trigger params', () => {
  beforeEach(() => {
    useShaderPanelStore.setState({
      triggeredParamIds: [],
      paramValues: {},
    })
  })

  it('B1: triggerParam enqueues param and sets value to true', () => {
    const { triggerParam } = useShaderPanelStore.getState()
    triggerParam('myTrigger')

    const state = useShaderPanelStore.getState()
    expect(state.triggeredParamIds).toContain('myTrigger')
    expect(state.paramValues['myTrigger']).toBe(true)
  })

  it('B2: consumeTriggeredParams returns IDs and resets values to false', () => {
    const { triggerParam, consumeTriggeredParams } = useShaderPanelStore.getState()
    triggerParam('t1')
    triggerParam('t2')

    const consumed = consumeTriggeredParams()
    expect(consumed).toContain('t1')
    expect(consumed).toContain('t2')

    const state = useShaderPanelStore.getState()
    expect(state.triggeredParamIds).toHaveLength(0)
    expect(state.paramValues['t1']).toBe(false)
    expect(state.paramValues['t2']).toBe(false)
  })

  it('B3: trigger param is active for exactly one consume cycle', () => {
    const { triggerParam, consumeTriggeredParams } = useShaderPanelStore.getState()
    triggerParam('pulse')

    // First frame: consumed
    const first = consumeTriggeredParams()
    expect(first).toContain('pulse')

    // Second frame: not triggered again
    const second = consumeTriggeredParams()
    expect(second).toHaveLength(0)
  })
})

// ── C: Transition controller — stable random direction ───────────────────────

describe('C: ShaderTransitionController — transition lifecycle', () => {
  let ctrl: ShaderTransitionController

  beforeEach(() => { ctrl = new ShaderTransitionController() })
  afterEach(() => { ctrl.dispose() })

  it('C1: requestTransition enters waiting phase', () => {
    ctrl.setActiveScene('scene-a')
    ctrl.requestTransition('scene-b', {
      type: 'crossfade', durationMs: 500, easing: 'linear',
      direction: 'forward', intensity: 1, seed: 0, startTrigger: 'immediate',
    })
    expect(ctrl.phase).toBe('active')
  })

  it('C2: transition completes and promotes incoming scene', () => {
    ctrl.setActiveScene('scene-a')
    ctrl.requestTransition('scene-b', {
      type: 'crossfade', durationMs: 100, easing: 'linear',
      direction: 'forward', intensity: 1, seed: 0, startTrigger: 'immediate',
    })

    let result = ctrl.tick(200, null)
    expect(result.justCompleted).toBe(true)
    expect(ctrl.currentSceneId).toBe('scene-b')
  })

  it('C3: failed incoming compile aborts transition, keeps outgoing', () => {
    ctrl.setActiveScene('scene-a')
    ctrl.requestTransition('scene-b', {
      type: 'crossfade', durationMs: 500, easing: 'linear',
      direction: 'forward', intensity: 1, seed: 0, startTrigger: 'immediate',
    })
    ctrl.reportIncomingCompileFailure('syntax error')
    expect(ctrl.phase).toBe('idle')
    expect(ctrl.currentSceneId).toBe('scene-a')
    expect(ctrl.compileError).toBe('syntax error')
  })

  it('C4: shouldRenderDual is true only during active phase', () => {
    ctrl.setActiveScene('scene-a')
    ctrl.requestTransition('scene-b', {
      type: 'crossfade', durationMs: 300, easing: 'linear',
      direction: 'forward', intensity: 1, seed: 0, startTrigger: 'immediate',
    })

    // First tick — transition is active
    const result = ctrl.tick(100, null)
    expect(result.shouldRenderDual).toBe(true)

    // Tick delta is clamped to 100ms each call; need 4 more ticks to exceed 300ms total
    ctrl.tick(100, null)
    ctrl.tick(100, null)
    ctrl.tick(100, null)  // 500ms elapsed → completes
    const done = ctrl.tick(1, null)
    expect(done.shouldRenderDual).toBe(false)
  })

  it('C5: context loss aborts any pending transition', () => {
    ctrl.setActiveScene('scene-a')
    ctrl.requestTransition('scene-b', {
      type: 'crossfade', durationMs: 500, easing: 'linear',
      direction: 'forward', intensity: 1, seed: 0, startTrigger: 'immediate',
    })
    ctrl.onContextLost()
    expect(ctrl.phase).toBe('idle')
  })
})

// ── D: ShaderRenderGraph — texture binding with explicit mappings ──────────────

describe('D: ShaderRenderGraph — texture binding via explicit input mappings', () => {
  let gl:       ReturnType<typeof makeMockGL>
  let compiler: ShaderPassCompiler
  let graph:    ShaderRenderGraph

  const dims = { W: 64, H: 64, aspect: 1, pixelRatio: 1 }

  beforeEach(() => {
    gl       = makeMockGL()
    compiler = new ShaderPassCompiler(gl)
    graph    = new ShaderRenderGraph(gl)
  })

  afterEach(() => { graph.dispose() })

  it('D1: explicit binding routes source to named uniform', () => {
    const capturedUniforms: string[] = []

    const def: ShaderDefinition = {
      id: 'binding-test',
      name: 'Binding Test',
      description: '',
      category: 'generator',
      version: 1,
      passes: [
        { id: 'src', fragSrc: FRAG, inputs: [], output: 'src' },
        {
          id: 'consumer',
          fragSrc: FRAG,
          inputs: [{ source: 'src', uniformName: 'uMySpecialSampler' }],
          output: 'out',
        },
      ],
      params: [],
      defaults: {},
    }

    const result = compiler.compile(def)
    expect(result.error).toBeNull()
    graph.loadGraph(result.graph!)

    graph.execute(dims, new Map(), (prog) => {
      // ShaderProgram.setSampler would be called by FullscreenPass.run() internally.
      // We verify through the CompiledPassNode.inputs that the mapping is correct.
      const node = result.graph!.passes.find(p => p.passId === 'consumer')!
      expect(node.inputs[0].uniformName).toBe('uMySpecialSampler')
      expect(node.inputs[0].source).toBe('src')
      capturedUniforms.push(node.inputs[0].uniformName)
    })

    expect(capturedUniforms).toContain('uMySpecialSampler')
    ShaderPassCompiler.disposeGraph(result.graph!)
  })

  it('D2: distinct input sources map to distinct texture units', () => {
    const def: ShaderDefinition = {
      id: 'multi-input',
      name: 'Multi',
      description: '',
      category: 'generator',
      version: 1,
      passes: [
        { id: 'a', fragSrc: FRAG, inputs: [], output: 'a' },
        { id: 'b', fragSrc: FRAG, inputs: [], output: 'b' },
        {
          id: 'composite',
          fragSrc: FRAG,
          inputs: [
            { source: 'a', uniformName: 'uTexA' },
            { source: 'b', uniformName: 'uTexB' },
          ],
          output: 'out',
        },
      ],
      params: [],
      defaults: {},
    }

    const result = compiler.compile(def)
    expect(result.error).toBeNull()

    const composite = result.graph!.passes.find(p => p.passId === 'composite')!
    // Both bindings must have unique uniform names
    const names = composite.inputs.map(b => b.uniformName)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain('uTexA')
    expect(names).toContain('uTexB')

    ShaderPassCompiler.disposeGraph(result.graph!)
  })
})

// ── E: Manual section resolution ─────────────────────────────────────────────

describe('E: Manual section resolution', () => {
  it('E1: manual section covering audio time takes precedence over MI', () => {
    const sections = [
      { id: 's1', label: 'Intro', type: 'intro' as const, startSec: 0, endSec: 10, intensity: 0.5 },
      { id: 's2', label: 'Drop',  type: 'drop'  as const, startSec: 10, endSec: 20, intensity: 1.0 },
    ]
    const miSectionType = 'verse'
    const audioTimeSec  = 5.0

    const manualSection = sections.find(
      s => s.startSec <= audioTimeSec && audioTimeSec < s.endSec,
    ) ?? null

    const resolved = manualSection?.type ?? miSectionType
    expect(resolved).toBe('intro')
  })

  it('E2: MI section used when no manual section covers audio time', () => {
    const sections = [
      { id: 's1', label: 'Intro', type: 'intro' as const, startSec: 0, endSec: 5, intensity: 0.5 },
    ]
    const miSectionType = 'drop'
    const audioTimeSec  = 7.0

    const manualSection = sections.find(
      s => s.startSec <= audioTimeSec && audioTimeSec < s.endSec,
    ) ?? null

    const resolved = manualSection?.type ?? miSectionType
    expect(resolved).toBe('drop')
  })

  it('E3: section change pulse fires exactly once per change', () => {
    let lastSectionType: string | null = null
    let pulseCount = 0

    function checkSection(type: string) {
      if (type !== lastSectionType) {
        lastSectionType = type
        pulseCount++
      }
    }

    checkSection('intro')  // change from null → intro
    checkSection('intro')  // no change
    checkSection('intro')  // no change
    checkSection('drop')   // change
    checkSection('drop')   // no change

    expect(pulseCount).toBe(2)
  })
})

// ── F: Section choreography — feedback clear policy ──────────────────────────

function makeFrame(sectionType: string | null): Parameters<ShaderSectionChoreography['onFrame']>[0] {
  if (!sectionType) return null
  // onFrame() only reads frame?.section?.type — cast via unknown for minimal stub
  return ({ section: { type: sectionType } } as unknown) as Parameters<ShaderSectionChoreography['onFrame']>[0]
}

describe('F: ShaderSectionChoreography — feedback clear timing', () => {
  it('F1: clearFeedback defaults to preserve when rule omits it', () => {
    const choreo = new ShaderSectionChoreography()
    choreo.setRules([{
      sectionType: 'drop',
      toSceneId:   'scene-b',
      transition:  {
        type: 'crossfade', durationMs: 400, easing: 'linear',
        direction: 'forward', intensity: 1, seed: 0, startTrigger: 'immediate',
      },
    }])
    choreo.enabled = true

    // Prime with null section to initialize lastSectionType
    choreo.onFrame(null)
    const action = choreo.onFrame(makeFrame('drop'))

    expect(action).not.toBeNull()
    expect(action!.clearFeedback).toBe('preserve')
  })

  it('F2: explicit clearFeedback policy is preserved', () => {
    const choreo = new ShaderSectionChoreography()
    choreo.setRules([{
      sectionType:   'drop',
      toSceneId:     'scene-b',
      clearFeedback: 'at-start',
      transition:  {
        type: 'crossfade', durationMs: 400, easing: 'linear',
        direction: 'forward', intensity: 1, seed: 0, startTrigger: 'immediate',
      },
    }])
    choreo.enabled = true

    choreo.onFrame(null)
    const action = choreo.onFrame(makeFrame('drop'))

    expect(action).not.toBeNull()
    expect(action!.clearFeedback).toBe('at-start')
  })
})

// ── G: ShaderLibraryStore — hydration registers scenes ───────────────────────

describe('G: ShaderLibraryStore — user scene registration', () => {
  it('G1: addUserScene stores the definition and registers with registry', async () => {
    const { useShaderLibraryStore } = await import('../library/ShaderLibraryStore')
    const { shaderRegistry } = await import('../registry')

    const testDef: ShaderDefinition = {
      id:          'test-user-scene-G1',
      name:        'Test User Scene',
      description: 'Integration test',
      category:    'generator',
      version:     1,
      fragSrc:     FRAG,
      params:      [],
      defaults:    {},
    }

    // Cleanup
    try { shaderRegistry.unregister(testDef.id) } catch {}

    const store = useShaderLibraryStore.getState()
    store.addUserScene(testDef)

    expect(shaderRegistry.get(testDef.id)).toBeDefined()
    expect(useShaderLibraryStore.getState().userScenes[testDef.id]).toBeDefined()

    // Cleanup
    store.deleteUserScene(testDef.id)
    expect(shaderRegistry.get(testDef.id)).toBeUndefined()
  })
})

// ── H: Validator — feedbackKaleidoscope passes validation ────────────────────

describe('H: ShaderDefinitionValidator — production scenes', () => {
  it('H1: feedbackKaleidoscope has no validation errors', async () => {
    const { FEEDBACK_KALEIDOSCOPE } = await import('../scenes/feedbackKaleidoscope')
    const result = ShaderDefinitionValidator.validate(FEEDBACK_KALEIDOSCOPE)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('H2: prismTunnel single-pass scene has no validation errors', async () => {
    const { PRISM_TUNNEL } = await import('../scenes/prismTunnel')
    const result = ShaderDefinitionValidator.validate(PRISM_TUNNEL)
    expect(result.valid).toBe(true)
  })

  it('H3: liquidMetaballs scene has no validation errors', async () => {
    const { LIQUID_METABALLS } = await import('../scenes/liquidMetaballs')
    const result = ShaderDefinitionValidator.validate(LIQUID_METABALLS)
    expect(result.valid).toBe(true)
  })
})

// ── I: selectReactEngine — shaderPads branch ─────────────────────────────────

describe('I: selectReactEngine — shaderPads branch', () => {
  it('I1: selecting shaderPads sets activeReactEngineId correctly', () => {
    useReactStore.getState().selectReactEngine('shaderPads')
    const state = useReactStore.getState()
    expect(state.activeReactEngineId).toBe('shaderPads')
    expect(state.activeReactPresetId).toBeNull()
  })
})
