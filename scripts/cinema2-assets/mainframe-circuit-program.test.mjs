import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import ts from 'typescript'

// Exercise the actual authored TypeScript program with Node's test runner. The
// audio adapter is shared with production, but needs no browser or WebGL mock.
// This suite also runs in environments where the Vitest dev bundle is absent.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const cache = new Map()
const nodeRequire = createRequire(import.meta.url)
function load(relativePath) {
  const path = resolve(root, relativePath)
  if (cache.has(path)) return cache.get(path).exports
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    reportDiagnostics: true,
    fileName: path,
  })
  assert.equal(compiled.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, `Invalid TypeScript: ${relativePath}`)
  const mod = { exports: {} }
  cache.set(path, mod)
  const requireFromModule = dependency => dependency.startsWith('.')
    ? load(resolve(dirname(path), `${dependency}.ts`)) : nodeRequire(dependency)
  // The code being compiled is repository-owned code, not user input.
  new Function('module', 'exports', 'require', compiled.outputText)(mod, mod.exports, requireFromModule)
  return mod.exports
}
const { evaluateCinema2MainframePattern, CINEMA2_MAINFRAME_PATTERN_IDS } = load('src/components/vyzualz/cinema2/modules/mainframe/Cinema2MainframePatternEngine.ts')
const { CINEMA2_MAINFRAME_ZERO_SIGNALS: silent, CINEMA2_MAINFRAME_ZERO_IMPULSES: empty } = load('src/components/vyzualz/cinema2/modules/mainframe/Cinema2MainframeReactivity.ts')
const { createCinema2MainframeLightingDiagnosticFrame } = load('src/components/vyzualz/cinema2/modules/mainframe/Cinema2MainframeLightingDiagnostic.ts')
const { resolveCinema2MainframeHardwareLighting } = load('src/components/vyzualz/cinema2/modules/mainframe/Cinema2MainframeHardwareLighting.ts')

const evaluate = (signals, impulses = empty, pattern = 'outward-bus') => evaluateCinema2MainframePattern({
  signals, impulses, pattern, beats: 1.625,
})

test('Mainframe circuit program requires real energy or events to excite a chase', () => {
  const unpowered = evaluate(silent)
  assert.equal(unpowered.circuitEnergy, 0)
  assert.equal(unpowered.circuitAccent, 0)
  assert.equal(unpowered.circuitPulse, 0)
  const powered = evaluate({ ...silent, bass: 0.7, sub: 0.55, overall: 0.5 })
  assert.ok(powered.circuitEnergy > 0.4)
  assert.ok(powered.circuitPulse > 0)
  assert.equal(powered.circuitAccent, 0)
})

test('kick, snare, beat, downbeat, phrase and drop all deliver distinct circuit accents', () => {
  const signals = { ...silent, bass: 0.55, overall: 0.4 }
  const base = evaluate(signals)
  const accents = ['kick', 'snare', 'beat', 'downbeat', 'phrase', 'drop']
  const strengths = accents.map(kind => {
    const lit = evaluate(signals, { ...empty, [kind]: 1 })
    assert.ok(lit.circuitAccent > base.circuitAccent, kind)
    assert.ok(lit.circuitPulse > base.circuitPulse, kind)
    return lit.circuitAccent
  })
  assert.ok(new Set(strengths).size >= 5, 'Different musical events should not have identical intensity')
})

test('all six pattern identities stay independent, with inward and outward directional chases', () => {
  assert.equal(CINEMA2_MAINFRAME_PATTERN_IDS.length, 6)
  const signals = { ...silent, bass: 0.45, overall: 0.4 }
  const programs = CINEMA2_MAINFRAME_PATTERN_IDS.map(pattern => evaluate(signals, { ...empty, beat: 0.7, drop: 0.3 }, pattern))
  assert.deepEqual(programs.map(value => value.pattern), CINEMA2_MAINFRAME_PATTERN_IDS)
  assert.equal(programs[0].chaseDirection, 1)
  assert.equal(programs[1].chaseDirection, -1)
  assert.ok(programs.every(program => program.circuitPulse > 0 && program.chaseWidth > 0))
  assert.ok(new Set(programs.map(program => JSON.stringify([program.chaseGain, program.chaseWidth, program.bankWeights, program.regionWeights]))).size >= 5)
})

test('the audio-free diagnostic still powers the circuit family independently', () => {
  const circuits = createCinema2MainframeLightingDiagnosticFrame('circuits')
  const chips = createCinema2MainframeLightingDiagnosticFrame('chips')
  assert.equal(circuits.active, true)
  assert.equal(circuits.circuitEnergy, 1)
  assert.equal(circuits.circuitPulse, 0)
  assert.equal(circuits.systemGains[1], 1)
  assert.equal(chips.circuitEnergy, 0)
  assert.equal(chips.systemGains[1], 0)
})

test('the production shader drives the narrow core by path phase and gates the six authored patterns', () => {
  const source = readFileSync(resolve(root, 'src/components/vyzualz/cinema2/modules/three/Cinema2ThreeSceneBridge.ts'), 'utf8')
  const start = source.indexOf('function addMainframeLighting(')
  const end = source.indexOf('\nconst initializedAreaLightTables', start)
  assert.ok(start > 0 && end > start, 'Missing production Mainframe shader builder')
  const extract = `${source.slice(start, end)}\nexports.inject = addMainframeLighting;`
  const compiled = ts.transpileModule(extract, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const output = {}
  const names = ['_glow_phase', '_mainframe_route', '_mainframe_bank', '_mainframe_region', '_mainframe_system']
  new Function('exports', 'CINEMA2_GLOW_PHASE_ATTRIBUTE', 'CINEMA2_MAINFRAME_ROUTE_ATTRIBUTE',
    'CINEMA2_MAINFRAME_BANK_ATTRIBUTE', 'CINEMA2_MAINFRAME_REGION_ATTRIBUTE', 'CINEMA2_MAINFRAME_SYSTEM_ATTRIBUTE',
    compiled.outputText)(output, ...names)
  const shader = { vertexShader: '#include <common>\n#include <begin_vertex>',
    fragmentShader: '#include <common>\n#include <emissivemap_fragment>', uniforms: {} }
  const response = { value: [0.6, 0.8, 0.7, 2] }
  output.inject(shader, { uCinema2MainframeCircuitResponse: response }, { value: 0 })
  assert.equal(shader.uniforms.uCinema2MainframeCircuitResponse, response)
  assert.match(shader.vertexShader, /vCinema2MainframePhase = _glow_phase/)
  assert.match(shader.vertexShader, /_mainframe_route, _mainframe_bank, _mainframe_region, _mainframe_system/)
  assert.match(shader.fragmentShader, /mode > 0\.5 && mode < 1\.5.*cinema2MFBankLight/)
  assert.match(shader.fragmentShader, /mode > 1\.5 && mode < 2\.5.*cinema2MFRegionLight/)
  assert.match(shader.fragmentShader, /mode > 3\.5.*cinema2MFRegionLight/)
  assert.match(shader.fragmentShader, /exp\( -cinema2MFDistance \* cinema2MFDistance \)/)
  assert.match(shader.fragmentShader, /uCinema2MainframeRole > 4\.5 \? 0\.12 \* poweredLight : coreLight/)
  assert.doesNotMatch(shader.fragmentShader, /gl_FragCoord/, 'Chase must not use screen-space motion')
})


test('hardware lighting uses independent shared audio envelopes without inventing events', () => {
  assert.deepEqual(resolveCinema2MainframeHardwareLighting(evaluate(silent)), [0, 0, 0, 0])
  assert.deepEqual(resolveCinema2MainframeHardwareLighting(evaluate(silent, { ...empty, kick: 1 })), [0.76, 0, 0, 0])
  const withMids = resolveCinema2MainframeHardwareLighting(evaluate({ ...silent, mid: 0.8 }))
  assert.ok(withMids[2] > 0 && withMids[3] > withMids[2])
  assert.equal(withMids[0], 0)
  assert.equal(withMids[1], 0)
  const withHighs = resolveCinema2MainframeHardwareLighting(evaluate({ ...silent, high: 0.8 }))
  assert.ok(withHighs[1] > withHighs[3])
  assert.equal(withHighs[0], 0)
  const accents = resolveCinema2MainframeHardwareLighting(evaluate(silent, { ...empty, phrase: 1, downbeat: 1 }))
  assert.ok(accents[2] > 0 && accents[3] > 0)
  assert.deepEqual(resolveCinema2MainframeHardwareLighting(evaluate({ ...silent, mid: 4, high: 9 }, { ...empty, drop: 4 })), [1, 1, 1, 1])
  const stopped = evaluateCinema2MainframePattern({ signals: { ...silent, mid: 1 }, impulses: { ...empty, drop: 1 },
    pattern: 'radar-sweep', beats: 4, active: false })
  assert.deepEqual(resolveCinema2MainframeHardwareLighting(stopped), [0, 0, 0, 0])
})

test('hardware shader can address discrete ring and chip details without leaking into circuits', () => {
  const source = readFileSync(resolve(root, 'src/components/vyzualz/cinema2/modules/three/Cinema2ThreeSceneBridge.ts'), 'utf8')
  assert.match(source, /radarHardware.*radarHousing|radarHousing.*chipHousing/s)
  assert.match(source, /vCinema2MainframeCycle = vec2\( cos\(/)
  assert.match(source, /float radarWave = hwSweep/)
  assert.match(source, /float chipPins = cinema2MFRoute/)
  assert.match(source, /uCinema2MainframeHardware\.x/)
  assert.match(source, /uCinema2MainframeHardware\.y/)
  assert.match(source, /uCinema2MainframeHardware\.z/)
  assert.match(source, /uCinema2MainframeHardware\.w/)
  assert.doesNotMatch(source.slice(source.indexOf('function addMainframeLighting('), source.indexOf('const initializedAreaLightTables')), /gl_FragCoord/)
})
