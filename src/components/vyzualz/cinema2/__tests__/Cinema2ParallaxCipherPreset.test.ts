import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { cinema2Ref } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_CRATE_PRESET_MANIFESTS } from '../presets/Cinema2CratePresets'
import { CINEMA2_PARALLAX_CIPHER_LINE_MODE_ID, CINEMA2_PARALLAX_CIPHER_LINE_TWO_TEXT_ID, CINEMA2_PARALLAX_CIPHER_PATTERN_ID, CINEMA2_PARALLAX_CIPHER_TEXT_ID, PARALLAX_CIPHER_SCORE_CHANNELS, PARALLAX_CIPHER_MODULE_BINDINGS, parallaxCipherParameterId } from '../presets/Cinema2ParallaxCipherPreset'
import { Cinema2ParallaxCipherScene } from '../modules/crate/Cinema2ParallaxCipherScene'
import { layoutParallaxCipherGlyphs } from '../modules/crate/Cinema2ParallaxCipherLayout'
import { PARALLAX_CIPHER_PALETTE_DEFAULTS } from '../modules/crate/Cinema2ParallaxCipherPalette'
import { evaluateParallaxCipherLetter, evaluateParallaxCipherTransition, PARALLAX_CIPHER_TEXT_TRANSITION_BEATS } from '../modules/crate/Cinema2ParallaxCipherTextEffects'
import { CINEMA2_PARALLAX_CIPHER_PATTERN_IDS, evaluateParallaxCipherBank, evaluateParallaxCipherScene } from '../modules/crate/Cinema2ParallaxCipherPatterns'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import { PARALLAX_CIPHER_EYE } from '../modules/crate/Cinema2ParallaxCipherLayout'
import { loadCinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { describeMoodMigration } from './support/describeMoodMigration'
import { moodMusic } from './support/MoodMigrationHarness'

const manifest = CINEMA2_CRATE_PRESET_MANIFESTS.find(preset => preset.id === 'drmvyz.cinema2.crate-paradox-weave')!
const defaults: Record<string, unknown> = Object.fromEntries(manifest.parameters!.map(parameter => [parameter.id, parameter.defaultValue]))

/** Builds the scene over synthetic plates and the real glyph names, and returns a function that applies controls and draws one frame at the given beat position. */
async function createScene(controls: Record<string, unknown> = {}) {
  const library = await loadCinema2ThreeLibrary()
  const scene = new Cinema2ParallaxCipherScene(library)
  const plates = new THREE.Group()
  for (let index = 0; index < 48; index += 1) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1 + index % 3, 1, .1), new THREE.MeshStandardMaterial())
    plate.name = `plate-${index}`
    plates.add(plate)
  }
  const red = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .2), new THREE.MeshStandardMaterial({ name: 'Material' }))
  plates.add(red)
  const letters = new THREE.Group()
  const meshNames = new Set(['PARADOX', 'CIPHER', 'SPLIT', 'OTHER WORD'].flatMap(word => layoutParallaxCipherGlyphs(word).map(({ glyph }) => glyph.mesh)))
  for (const mesh of meshNames) {
    for (const name of [mesh, `${mesh}-led`]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial())
      mesh.name = name
      letters.add(mesh)
    }
  }
  scene.attach(plates, false, [], 'cinema2-crate-paradox-weave')
  scene.attach(letters, false, [], 'cinema2-say-it-glyphs')
  const values = new Map<string, unknown>()
  const revisions = new Map<string, number>()
  const set = (name: string, value: unknown) => { values.set(name, value); revisions.set(name, (revisions.get(name) ?? 0) + 1) }
  for (const name of PARALLAX_CIPHER_MODULE_BINDINGS) values.set(name, defaults[parallaxCipherParameterId(name)])
  values.set('cipherText', 'PARADOX')
  values.set('lineTwoText', '')
  for (const name of PARALLAX_CIPHER_SCORE_CHANNELS) values.set(name, 0)
  for (const [name, value] of Object.entries(controls)) values.set(name, value)
  const parameters = { get: (name: string) => values.get(name), getEditRevision: (name: string) => revisions.get(name) ?? 0 }
  const draw = (beats: number) => {
    // The beat clock starts at elapsed seconds x 120 BPM / 60, so the first frame places it exactly. 1.65 s is inside the camera's first hold.
    scene.update({ frame: { elapsedTimeSec: beats / 2, deltaTimeSec: 0, timestampMs: 0, contextGeneration: 1 }, parameters } as never)
    scene.beforeDraw()
  }
  // Frames advance the clock in 0.1 s steps (the first call places it exactly), for tests that need time to pass inside one scene.
  let seconds = 0, stamp = 0, started = false
  const run = (beats: number) => {
    const target = beats / 2
    const frame = (dt: number) => { scene.update({ frame: { elapsedTimeSec: seconds, deltaTimeSec: dt, timestampMs: stamp, contextGeneration: 1 }, parameters } as never); scene.beforeDraw() }
    if (!started) { started = true; seconds = target; stamp = seconds * 1000; frame(0); return }
    while (seconds < target - 1e-9) { const dt = Math.min(.1, target - seconds); seconds += dt; stamp += dt * 1000; frame(dt) }
  }
  const banks = () => {
    const root = (scene as unknown as { plateBanks: { object: THREE.Group; index: number; side: number; turn: number; baseX: number; baseY: number }[] }).plateBanks
    return root
  }
  const internals = scene as unknown as { shownText: string; knot: THREE.Group; glyphs: { node: THREE.Group }[]; glows: { material: THREE.MeshBasicMaterial; role: string; palette: string; bank: number | null }[] }
  /** Runs one real runtime frame (with the mood and director) through the scene. */
  const step = (frame: unknown) => { scene.update({ frame, parameters } as never); scene.beforeDraw() }
  return { scene, set, draw, run, step, banks, internals, pattern: () => scene.inspect().pattern as string, shown: () => scene.inspect() as { shownText: string; textTransition: boolean; glyphCount: number } }
}

describe('Paradox Weave — Parallax Cipher controls', () => {
  it('exposes the standard Design controls, six patterns, a palette and the bloom', () => {
    const byId = new Map(manifest.parameters!.map(parameter => [parameter.id, parameter]))
    expect(manifest.revision).toBe(4)
    const pattern = byId.get(CINEMA2_PARALLAX_CIPHER_PATTERN_ID)!
    expect(pattern).toMatchObject({ label: 'Pattern', type: 'enum', designParentGroup: 'design', group: 'Pattern' })
    expect((pattern.options as readonly unknown[]).length).toBeGreaterThanOrEqual(6)
    expect(byId.get(parallaxCipherParameterId('patternChange'))).toMatchObject({ label: 'Pattern Change', type: 'boolean', defaultValue: false, group: 'Pattern' })
    expect(byId.get(parallaxCipherParameterId('trigger'))).toMatchObject({ label: 'Trigger', type: 'enum', group: 'Pattern', visibleWhen: [expect.objectContaining({ parameterId: parallaxCipherParameterId('patternChange'), value: true })] })
    expect(byId.get(parallaxCipherParameterId('bpmSync'))).toMatchObject({ label: 'BPM Sync', designParentGroup: 'master-controls', defaultValue: true })
    expect(manifest.parameters!.filter(parameter => parameter.type === 'color' && parameter.designParentGroup === 'palette').length).toBeGreaterThanOrEqual(4)
    expect(byId.get(CINEMA2_PARALLAX_CIPHER_TEXT_ID)).toMatchObject({ group: 'Typography' })
    expect(manifest.effects!.find(effect => effect.typeId === 'hdr-bloom')!.parameterBindings?.intensity).toEqual(cinema2Ref(parallaxCipherParameterId('bloom')))
    // No control is declared without a reader: the module, an effect, a light or the camera.
    const bound = new Set([
      ...Object.values(manifest.modules![0]!.parameterBindings!), ...Object.values(manifest.cameras![0]!.controls!),
      ...manifest.effects!.flatMap(effect => Object.values(effect.parameterBindings ?? {})), ...manifest.lighting!.lights.flatMap(light => Object.values(light.controls ?? {})),
    ].map(ref => ref.$ref as string))
    for (const parameter of manifest.parameters!) expect(bound.has(parameter.id as string), parameter.label).toBe(true)
  })

  it('moves every Geometry and Lighting control', async () => {
    const reference = await createScene()
    reference.draw(3.3)
    const rest = reference.banks().map(bank => [bank.object.position.x, bank.object.rotation.y])
    const restKnot = reference.internals.knot.scale.x
    expect(restKnot).toBeCloseTo(2.45)
    const wide = await createScene({ plateSpread: 1.5 })
    wide.draw(3.3)
    wide.banks().forEach((bank, index) => expect(bank.object.position.x).toBeCloseTo(rest[index]![0]! * 1.5))
    const still = await createScene({ bankTwist: 0 })
    still.draw(3.3)
    still.banks().forEach(bank => expect(bank.object.rotation.y).toBeCloseTo(bank.turn))
    const big = await createScene({ weaveScale: 1.6 })
    big.draw(3.3)
    expect(big.internals.knot.scale.x).toBeCloseTo(2.45 * 1.6)
    const flat = await createScene({ depthStagger: 0 })
    flat.draw(3.3)
    expect(flat.internals.glyphs.every(({ node }) => Math.abs(node.position.z) < 1e-9)).toBe(true)
    const deep = await createScene()
    deep.draw(3.3)
    expect(new Set(deep.internals.glyphs.map(({ node }) => node.position.z.toFixed(3))).size).toBeGreaterThan(3)
    for (const [control, role] of [['nearContours', 'near'], ['farContours', 'far'], ['letterBevels', 'letter-bevels'], ['registrationDots', 'registration-dots'], ['redMarker', 'red-alignment-marker']] as const) {
      const off = await createScene({ [control]: 0 })
      off.draw(3.3)
      const touched = off.internals.glows.filter(entry => entry.role.startsWith(role))
      expect(touched.length, control).toBeGreaterThan(0)
      for (const entry of touched) expect(entry.material.color.r + entry.material.color.g + entry.material.color.b, control).toBe(0)
      const others = off.internals.glows.filter(entry => !entry.role.startsWith(role))
      expect(others.some(entry => entry.material.color.r + entry.material.color.g + entry.material.color.b > 0), control).toBe(true)
    }
    const dark = await createScene({ intensity: 0 })
    dark.draw(3.3)
    for (const entry of dark.internals.glows) expect(entry.material.color.r + entry.material.color.g + entry.material.color.b).toBe(0)
  })

  it('tints from the palette and reproduces the authored look at the defaults', async () => {
    const authored = await createScene()
    authored.draw(3.3)
    const left = authored.internals.glows.find(entry => entry.palette === 'leftBankColor' && entry.role === 'registration-dots')!
    const expected = new THREE.Color().setRGB(...[0x61 / 255, 0xd9 / 255, 0xef / 255] as [number, number, number], THREE.SRGBColorSpace).multiplyScalar(.62)
    expect(left.material.color.r).toBeCloseTo(expected.r, 6)
    expect(left.material.color.g).toBeCloseTo(expected.g, 6)
    const red = await createScene({ leftBankColor: [1, .1, .1, 1], rightBankColor: [.1, .1, 1, 1], redMarkerColor: [.2, 1, .2, 1] })
    red.draw(3.3)
    const tinted = red.internals.glows.find(entry => entry.palette === 'leftBankColor' && entry.role === 'registration-dots')!
    expect(tinted.material.color.r).toBeGreaterThan(tinted.material.color.g * 3)
    const marker = red.internals.glows.find(entry => entry.palette === 'redMarkerColor')!
    expect(marker.material.color.g).toBeGreaterThan(marker.material.color.r * 2)
    expect(PARALLAX_CIPHER_PALETTE_DEFAULTS.leftBankColor[1]).toBeGreaterThan(PARALLAX_CIPHER_PALETTE_DEFAULTS.leftBankColor[0])
  })
})

describe('Paradox Weave — Parallax Cipher patterns', () => {
  it('has six patterns whose poses all differ, and Reading Line is the authored rest', () => {
    expect(CINEMA2_PARALLAX_CIPHER_PATTERN_IDS).toHaveLength(6)
    expect(evaluateParallaxCipherBank('reading-line', 3.3, 2, 1)).toEqual({ spread: 1, twist: 0, tip: 0, lift: 0, glow: 1 })
    const signatures = CINEMA2_PARALLAX_CIPHER_PATTERN_IDS.map(id => JSON.stringify([0, 1, 2, 3, 4, 5, 6].flatMap(index => [-1, 1].map(side => evaluateParallaxCipherBank(id, 3.3, index, side)))))
    expect(new Set(signatures).size).toBe(6)
    for (const id of CINEMA2_PARALLAX_CIPHER_PATTERN_IDS) for (const beats of [0, .4, 1.7, 5.2, 11.9]) for (const index of [0, 3, 6]) {
      for (const value of Object.values(evaluateParallaxCipherBank(id, beats, index, 1))) expect(Number.isFinite(value)).toBe(true)
      expect(evaluateParallaxCipherBank(id, beats, index, 1).spread).toBeGreaterThan(.3)
    }
  })

  it('throws the letters off the reading line only briefly, and they settle between beats', () => {
    for (const id of CINEMA2_PARALLAX_CIPHER_PATTERN_IDS) {
      if (id !== 'shatter') expect(evaluateParallaxCipherScene(id, 2.1).scatter).toBe(0)
    }
    expect(evaluateParallaxCipherScene('shatter', 4).scatter).toBeGreaterThan(.5)
    expect(evaluateParallaxCipherScene('shatter', 4.9).scatter).toBeLessThan(.1)
  })

  it('draws each pattern differently, takes a manual pick at once and falls back on an unknown id', async () => {
    const rig = await createScene()
    rig.draw(5.3)
    const reading = rig.banks().map(bank => [bank.object.position.x, bank.object.position.y, bank.object.rotation.y])
    rig.set('pattern', 'cascade')
    rig.draw(5.3)
    const cascade = rig.banks().map(bank => [bank.object.position.x, bank.object.position.y, bank.object.rotation.y])
    expect(cascade).not.toEqual(reading)
    const direct = await createScene({ pattern: 'cascade' })
    direct.draw(5.3)
    // A manual selection is the pattern at once (no blend from the previous one).
    expect(rig.banks().map(bank => bank.object.position.y)).toEqual(direct.banks().map(bank => bank.object.position.y))
    const unknown = await createScene({ pattern: 'not-a-pattern' })
    unknown.draw(5.3)
    expect(unknown.banks().map(bank => bank.object.position.x)).toEqual(reading.map(row => row[0]))
  })

  it('keeps the word readable at the reveal hold in every pattern', async () => {
    for (const id of CINEMA2_PARALLAX_CIPHER_PATTERN_IDS) {
      const rig = await createScene({ pattern: id })
      rig.draw(4.9)
      const layout = layoutParallaxCipherGlyphs('PARADOX')
      rig.internals.glyphs.forEach(({ node }, index) => {
        // Between beats the letters have settled to within a fraction of a unit of the solved line.
        const solved = layout[index]!.position
        expect(Math.hypot(node.position.x - solved[0], node.position.y - solved[1], node.position.z - solved[2]), id).toBeLessThan(.2)
      })
    }
  })
})

const MODULE = 'crate-paradox-weave-scene'
describeMoodMigration('Paradox Weave', [{
  name: 'Parallax Cipher performance', manifest, auto: parallaxCipherParameterId('autoPerformance'), strength: parallaxCipherParameterId('reactivity'),
  pattern: { patternChange: parallaxCipherParameterId('patternChange'), trigger: parallaxCipherParameterId('trigger') },
  up: [[MODULE, 'nearContours'], [MODULE, 'farContours'], ['crate-paradox-weave-light-bloom', 'intensity']],
  down: [[MODULE, 'bankTwist'], [MODULE, 'nearContours']],
  shock: [[MODULE, 'letterBevels']],
}])

describe('Paradox Weave — Auto Performance patterns', () => {
  const quiet = (music: ReturnType<typeof moodMusic>, count: number, rig: Awaited<ReturnType<typeof createScene>>, extra: Parameters<ReturnType<typeof moodMusic>['next']>[0] = {}) => { for (let i = 0; i < count; i += 1) rig.step(music.next({ energy: .8, ...extra })) }

  it('puts Collapse on stage for a build and returns to the authored Pattern, never rewriting the saved one', async () => {
    const rig = await createScene({ autoPerformance: true, pattern: 'cascade', reactivity: 1 })
    const music = moodMusic()
    // Auto Performance does not take over a build already under way, so it is on before this one starts.
    quiet(music, 20, rig)
    expect(rig.pattern()).toBe('cascade')
    for (let i = 0; i < 90; i += 1) rig.step(music.next({ energy: .8, build: Math.min(.9, i / 40) }))
    expect(rig.pattern(), 'a build is on stage').toBe('collapse')
    quiet(music, 500, rig)
    expect(rig.pattern(), 'the authored Pattern resumes').toBe('cascade')
  })

  it('puts Shatter on stage on a drop and then returns to the authored Pattern', async () => {
    const rig = await createScene({ autoPerformance: true, pattern: 'open-gate', reactivity: 1 })
    const music = moodMusic()
    quiet(music, 20, rig)
    expect(rig.pattern()).toBe('open-gate')
    for (let i = 0; i < 12; i += 1) rig.step(music.next({ energy: 1, bass: 1, event: 'drop', eventId: 900 + i, build: 0 }))
    expect(rig.pattern(), 'the drop is on stage').toBe('shatter')
    quiet(music, 700, rig)
    expect(rig.pattern(), 'the authored Pattern resumes').toBe('open-gate')
  })

  it('does nothing to the pattern with Auto Performance off, however the music builds and drops', async () => {
    const rig = await createScene({ autoPerformance: false, pattern: 'counter-spiral' })
    const music = moodMusic()
    quiet(music, 20, rig)
    for (let i = 0; i < 90; i += 1) rig.step(music.next({ energy: .8, build: Math.min(.9, i / 40) }))
    for (let i = 0; i < 12; i += 1) rig.step(music.next({ energy: 1, bass: 1, event: 'drop', eventId: 900 + i }))
    expect(rig.pattern()).toBe('counter-spiral')
  })
})

describe('Paradox Weave — Parallax Cipher camera', () => {
  const compiled = compileCinema2NativePreset(manifest)
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
  const rig = () => {
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, { resolveBaseValue: target => target.parameterId ? state.getValue(target.parameterId) : target.authoredBaseValue })
    const spatial = new Cinema2SpatialRuntime(compiled.plan.scene, compiled.plan.targets.targets, resolver)
    const camera = new Cinema2CameraRuntime(compiled.plan, state, resolver, spatial)
    const frame = (time: number, bpm = 120) => ({ frameId: Math.round(time * 30) + 1, timestampMs: time * 1000, elapsedTimeSec: time, deltaTimeSec: 1 / 30, contextGeneration: 1, viewport: { width: 1280, height: 720, dpr: 1 }, audio: null, director: null,
      transport: { sourcePresent: true, playing: true, paused: false, animationActive: true, timeSec: time, bpm } }) as never
    return { state, camera, frame }
  }
  const run = (rigged: ReturnType<typeof rig>, from: number, to: number, bpm = 120) => {
    let last = rigged.camera.update(rigged.frame(from, bpm))
    for (let time = from + 1 / 30; time <= to + 1e-6; time += 1 / 30) last = rigged.camera.update(rigged.frame(time, bpm))
    return last
  }

  it('declares the three modes, tempo-locked flight, a kick punch that only changes the lens, and no sway that would pull the letters off the sightline', () => {
    const camera = manifest.cameras![0]!
    expect(Object.keys(camera.rigVariants!)).toEqual(['reveal', 'path', 'manual'])
    expect(camera.motion!.tempo).toMatchObject({ flightSpeed: true, punch: 1.8 })
    expect(camera.motion!.tempo!.weave ?? 0).toBe(0)
    expect(camera.motion!.tempo!.bob ?? 0).toBe(0)
    expect(camera.motion!.tempo!.roll ?? 0).toBe(0)
    expect(camera.controls).toMatchObject({ rigMode: cinema2Ref(parallaxCipherParameterId('cameraMode')), tempoSync: cinema2Ref(parallaxCipherParameterId('bpmSync')), kickZoom: cinema2Ref(parallaxCipherParameterId('zoomOnKick')) })
    expect(defaults[parallaxCipherParameterId('cameraMode') as string]).toBe('path')
    expect(defaults[parallaxCipherParameterId('zoomOnKick') as string]).toBe(true)
  })

  it('holds the reveal sightline, swings out and back along the path, and stays inside the safety box', () => {
    const rigged = rig()
    const at = (time: number) => { rigged.camera.reset(); return run(rigged, 0, time).position }
    for (const time of [0, 1.5, 2.9]) expect(at(time)).toEqual([...PARALLAX_CIPHER_EYE])
    const swing = at(7.5)
    expect(swing[0]).toBeGreaterThan(3.5)
    rigged.camera.reset()
    for (let time = 0; time <= 24; time += 1 / 3) {
      const position = rigged.camera.update(rigged.frame(time)).position
      expect(position[0]).toBeGreaterThanOrEqual(-5.4 - 1e-9); expect(position[0]).toBeLessThanOrEqual(5.4 + 1e-9)
      expect(position[2]).toBeGreaterThanOrEqual(8.4)
    }
  })

  it('Reveal Hold keeps the one sightline at every moment', () => {
    const rigged = rig()
    rigged.state.setPersistentValue(parallaxCipherParameterId('cameraMode') as never, 'reveal' as never)
    rigged.camera.reset()
    for (const time of [0, 5, 7.5, 13, 19.5]) expect(run(rigged, time, time).position).toEqual([...PARALLAX_CIPHER_EYE])
  })

  it('locks the flight speed to the track tempo with BPM Sync on, and free-runs at the authored speed with it off', () => {
    const progress = (bpm: number, sync: boolean) => {
      const rigged = rig()
      rigged.state.setPersistentValue(parallaxCipherParameterId('bpmSync') as never, sync as never)
      rigged.camera.reset()
      return run(rigged, 0, 7.5, bpm).position[0]
    }
    const authored = progress(120, true)
    expect(progress(60, true)).toBeLessThan(authored - 1)
    expect(progress(60, false)).toBeCloseTo(authored, 1)
  })

  it('View Motion Speed scales the travel, and zero holds the view', () => {
    const at = (speed: number) => {
      const rigged = rig()
      rigged.state.setPersistentValue(parallaxCipherParameterId('cameraSpeed') as never, speed as never)
      rigged.camera.reset()
      return run(rigged, 0, 7.5).position[0]
    }
    expect(at(0)).toBeCloseTo(PARALLAX_CIPHER_EYE[0], 6)
    expect(at(2)).not.toBeCloseTo(at(1), 1)
  })

  it('Manual View orbits the weave by heading, elevation and distance, kept outside the plate banks', () => {
    const view = (heading: number, elevation: number, distance: number) => {
      const rigged = rig()
      const set = (name: string, value: unknown) => rigged.state.setPersistentValue(parallaxCipherParameterId(name) as never, value as never)
      set('cameraMode', 'manual'); set('cameraHeading', heading); set('cameraElevation', elevation); set('cameraDistance', distance)
      rigged.camera.reset()
      return run(rigged, 0, 0.2).position
    }
    const home = view(0, 0, PARALLAX_CIPHER_EYE[2])
    expect(home[0]).toBeCloseTo(0, 3); expect(home[2]).toBeCloseTo(PARALLAX_CIPHER_EYE[2], 2)
    expect(Math.abs(view(30, 0, 13.4)[0])).toBeGreaterThan(3)
    expect(view(0, 25, 13.4)[1]).toBeGreaterThan(home[1] + 3)
    expect(view(0, 0, 18)[2]).toBeGreaterThan(home[2] + 3)
    for (const heading of [-45, 45]) for (const distance of [10, 18]) {
      const position = view(heading, 0, distance)
      expect(Math.abs(position[0])).toBeLessThanOrEqual(5.4 + 1e-6)
      expect(position[2]).toBeGreaterThanOrEqual(8.4 - 1e-6)
    }
  })

  it('moves the letters and banks with the camera that is actually drawing', async () => {
    const home = await createScene()
    home.scene.update({ frame: { elapsedTimeSec: 1.65, deltaTimeSec: 0, timestampMs: 0, contextGeneration: 1 }, parameters: { get: () => undefined } } as never)
    home.scene.beforeDraw(undefined, { position: [0, .55, 13.4] })
    const homeRotation = home.internals.glyphs.map(({ node }) => node.rotation.y)
    expect(homeRotation.every(value => value === 0)).toBe(true)
    home.scene.beforeDraw(undefined, { position: [4.35, 1.72, 12.65] })
    expect(home.internals.glyphs.some(({ node }) => Math.abs(node.rotation.y) > .1)).toBe(true)
  })
})


describe('Paradox Weave — typed lines, text effects and transitions', () => {
  const REST = { dx: 0, dy: 0, dz: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1, glow: 1 }
  const byId = new Map(manifest.parameters!.map(parameter => [parameter.id, parameter]))

  it('has SAY IT\'s two text inputs: Line Mode, Line 1 and Line 2, with Line 2 and Line Hold shown only for two lines', () => {
    const typography = manifest.parameters!.filter(parameter => parameter.group === 'Typography').sort((a, b) => a.order! - b.order!)
    expect(typography.map(parameter => parameter.label)).toEqual(['Line Mode', 'Line 1', 'Line 2', 'Line Hold', 'Letter Motion'])
    expect(byId.get(CINEMA2_PARALLAX_CIPHER_TEXT_ID)).toMatchObject({ type: 'string', defaultValue: 'PARADOX' })
    expect(byId.get(CINEMA2_PARALLAX_CIPHER_LINE_TWO_TEXT_ID)).toMatchObject({ type: 'string', defaultValue: '', visibleWhen: [expect.objectContaining({ parameterId: CINEMA2_PARALLAX_CIPHER_LINE_MODE_ID, value: 'two' })] })
    expect(byId.get(CINEMA2_PARALLAX_CIPHER_LINE_MODE_ID)).toMatchObject({ type: 'enum', defaultValue: 'two', options: [{ value: 'one', label: 'One Line' }, { value: 'two', label: 'Two Lines' }] })
    expect(byId.get(parallaxCipherParameterId('lineHold'))).toMatchObject({ visibleWhen: [expect.objectContaining({ value: 'two' })] })
  })

  it('gives every pattern its own letter effect, and the letters are back on the line between beats', () => {
    const signatures = new Set(CINEMA2_PARALLAX_CIPHER_PATTERN_IDS.map(id => JSON.stringify([0.2, 0.7, 1.4, 2.3].map(beats => [0, 3, 6].map(index => evaluateParallaxCipherLetter(id, beats, index, 7))))))
    expect(signatures.size).toBe(CINEMA2_PARALLAX_CIPHER_PATTERN_IDS.length)
    for (const id of CINEMA2_PARALLAX_CIPHER_PATTERN_IDS) {
      for (let index = 0; index < 7; index += 1) {
        const settled = evaluateParallaxCipherLetter(id, 4.93, index, 7)
        expect(Math.hypot(settled.dx, settled.dy, settled.dz), id).toBeLessThan(.2)
      }
    }
  })

  it('takes a line off and the next on in each pattern\'s own style, hidden at the midpoint and at rest outside the transition', () => {
    const styles = new Set<string>()
    for (const id of CINEMA2_PARALLAX_CIPHER_PATTERN_IDS) {
      expect(evaluateParallaxCipherTransition(id, 0, 2, 7)).toEqual(REST)
      expect(evaluateParallaxCipherTransition(id, 1, 2, 7)).toEqual(REST)
      for (let index = 0; index < 7; index += 1) expect(evaluateParallaxCipherTransition(id, .5, index, 7).scale, `${id} ${index}`).toBeLessThan(.2)
      expect(evaluateParallaxCipherTransition(id, .2, 3, 7).scale).toBeLessThan(1)
      styles.add(JSON.stringify([.15, .3, .7, .85].map(progress => evaluateParallaxCipherTransition(id, progress, 4, 7))))
    }
    expect(styles.size).toBe(CINEMA2_PARALLAX_CIPHER_PATTERN_IDS.length)
  })

  it('shows one typed line at a time and rotates Line 1 and Line 2 every Line Hold bars through a transition', async () => {
    const rig = await createScene({ lineTwoText: 'CIPHER', lineHold: '4', pattern: 'counter-spiral' })
    rig.run(1)
    expect(rig.shown()).toMatchObject({ shownText: 'PARADOX', glyphCount: 7, textTransition: false })
    rig.run(15.9)
    expect(rig.shown().shownText).toBe('PARADOX')
    rig.run(16.5)
    expect(rig.shown().textTransition).toBe(true)
    // Before the midpoint the old word is still the one leaving.
    rig.run(17.5)
    expect(rig.shown().shownText).toBe('PARADOX')
    const leaving = rig.internals.glyphs.map(({ node }) => node.scale.x)
    rig.run(16 + PARALLAX_CIPHER_TEXT_TRANSITION_BEATS / 2 + .6)
    expect(rig.shown()).toMatchObject({ shownText: 'CIPHER', glyphCount: 6 })
    rig.run(16 + PARALLAX_CIPHER_TEXT_TRANSITION_BEATS + .5)
    expect(rig.shown().textTransition).toBe(false)
    expect(leaving.some(scale => scale > 0)).toBe(true)
    // The next hold brings Line 1 back.
    rig.run(32.6)
    rig.run(35)
    expect(rig.shown().shownText).toBe('PARADOX')
  })

  it('shrinks the letters away through the transition and restores them', async () => {
    const rig = await createScene({ lineTwoText: 'CIPHER', pattern: 'collapse' })
    rig.run(1)
    const rest = rig.internals.glyphs.map(({ node }) => node.scale.x)
    rig.run(16.1)
    rig.run(17)
    expect(Math.max(...rig.internals.glyphs.map(({ node }) => node.scale.x))).toBeLessThan(Math.max(...rest))
    rig.run(21)
    expect(rig.shown().textTransition).toBe(false)
    const settled = rig.internals.glyphs.map(({ node }) => node.scale.x)
    expect(settled.every(scale => scale > Math.min(...rest) * .5)).toBe(true)
  })

  it('swaps an edited line at once, with no transition, and ignores Line 2 in One Line mode', async () => {
    const rig = await createScene({ lineTwoText: 'CIPHER' })
    rig.run(1)
    rig.set('cipherText', 'SPLIT')
    rig.run(1.5)
    expect(rig.shown()).toMatchObject({ shownText: 'SPLIT', textTransition: false })
    const single = await createScene({ lineTwoText: 'CIPHER', lineMode: 'one' })
    single.run(1); single.run(17)
    expect(single.shown()).toMatchObject({ shownText: 'PARADOX', textTransition: false })
  })

  it('changes lines instantly at Letter Motion 0', async () => {
    const rig = await createScene({ lineTwoText: 'CIPHER', textMotion: 0 })
    rig.run(1)
    rig.run(16.5)
    expect(rig.shown()).toMatchObject({ shownText: 'CIPHER', textTransition: false })
  })

  it('plays the letter effect scaled by Letter Motion', async () => {
    const still = await createScene({ pattern: 'cascade', textMotion: 0 })
    const full = await createScene({ pattern: 'cascade', textMotion: 1 })
    still.draw(5.3); full.draw(5.3)
    const heights = (rig: typeof still) => rig.internals.glyphs.map(({ node }) => node.position.y)
    const rest = layoutParallaxCipherGlyphs('PARADOX').map(letter => letter.position[1])
    expect(heights(still).every((y, index) => Math.abs(y - rest[index]!) < 1e-9)).toBe(true)
    expect(heights(full).some((y, index) => Math.abs(y - rest[index]!) > .01)).toBe(true)
  })

  it('moves the letters with the pattern change: both patterns blend, and a pick lands at once', async () => {
    const rig = await createScene({ pattern: 'reading-line' })
    rig.draw(5.3)
    const before = rig.internals.glyphs.map(({ node }) => [node.position.y, node.rotation.x])
    rig.set('pattern', 'cascade')
    rig.draw(5.3)
    expect(rig.internals.glyphs.map(({ node }) => [node.position.y, node.rotation.x])).not.toEqual(before)
  })
})

describe('Paradox Weave — the score', () => {
  const rules = manifest.choreography!.rules
  it('fires the kick, snare and drop cues on their own channels, scaled by Audio Reactivity and gated by Score Amount', () => {
    const cues = rules.filter(rule => String(rule.id).startsWith('parallax-cipher-score-'))
    expect(cues.map(rule => rule.source.signal).sort()).toEqual(['drop', 'kick', 'snare'])
    for (const rule of cues) {
      expect(rule.enabledWhen).toEqual([{ kind: 'parameter-not-equals', parameterId: parallaxCipherParameterId('scoreAmount'), value: 0 }])
      expect(rule.strengthParameter).toEqual(cinema2Ref(parallaxCipherParameterId('reactivity')))
      expect(rule.actions[0]).toMatchObject({ operation: 'envelope', composition: 'replace' })
    }
    expect(manifest.modules![0]!.parameters).toMatchObject({ platePulse: 0, letterRipple: 0, dropRelease: 0 })
    expect(byIdTarget(cues)).toEqual(['dropRelease', 'letterRipple', 'platePulse'])
    expect(manifest.parameters!.find(parameter => parameter.id === parallaxCipherParameterId('scoreAmount'))).toMatchObject({ defaultValue: .5, min: 0, max: 1 })
  })

  const byIdTarget = (cues: typeof rules) => cues.map(rule => (rule.actions[0]!.target as { property: string }).property).sort()

  it('plays each channel on the scene: the kick on the plates, the snare on the letters, the drop on the weave and word, and Score Amount 0 silences them', async () => {
    const draw = async (controls: Record<string, unknown>) => {
      const rig = await createScene({ pattern: 'reading-line', ...controls })
      rig.run(5.3)
      return { banks: rig.banks().map(bank => [bank.object.position.x, bank.object.position.y]), letters: rig.internals.glyphs.map(({ node }) => [node.position.x, node.position.y, node.rotation.x]), knot: rig.internals.knot.scale.x }
    }
    const quiet = await draw({})
    const kick = await draw({ platePulse: 1 })
    const snare = await draw({ letterRipple: 1 })
    const drop = await draw({ dropRelease: 1 })
    expect(kick.banks).not.toEqual(quiet.banks); expect(kick.letters).toEqual(quiet.letters)
    expect(snare.letters).not.toEqual(quiet.letters); expect(snare.banks).toEqual(quiet.banks)
    expect(drop.knot).toBeGreaterThan(quiet.knot); expect(drop.letters).not.toEqual(quiet.letters)
    const off = await draw({ scoreAmount: 0, platePulse: 1, letterRipple: 1, dropRelease: 1 })
    expect(off).toEqual(quiet)
  })

  it('brings the other typed line on stage on a drop with Auto Performance on, and not with it off', async () => {
    const run = async (autoPerformance: boolean) => {
      const rig = await createScene({ autoPerformance, lineTwoText: 'CIPHER', reactivity: 1, lineHold: '16' })
      const music = moodMusic()
      for (let i = 0; i < 20; i += 1) rig.step(music.next({ energy: .4 }))
      for (let i = 0; i < 40; i += 1) rig.step(music.next({ energy: 1, bass: 1, event: 'drop', eventId: 900 + (i < 12 ? i : 11) }))
      for (let i = 0; i < 400; i += 1) rig.step(music.next({ energy: .6 }))
      return rig.shown().shownText
    }
    expect(await run(true)).toBe('CIPHER')
    expect(await run(false)).toBe('PARADOX')
  })
})

describe('Paradox Weave finishing', () => {
  const effect = (typeId: string) => manifest.effects!.find(entry => entry.typeId === typeId)!
  const control = (label: string) => manifest.parameters!.find(parameter => parameter.label === label)!

  it('runs the scene through floor, haze, focus, bloom, glare and grade, in that order, with depth where the effect needs it', () => {
    expect(manifest.effects!.map(entry => entry.typeId)).toEqual(['reflective-floor', 'volumetric-atmosphere', 'depth-of-field', 'hdr-bloom', 'glare', 'cinematic-finish'])
    const passes = manifest.render!.passes
    expect(passes.map(pass => pass.kind)).toEqual(['scene', 'fullscreen', 'fullscreen', 'fullscreen', 'fullscreen', 'fullscreen', 'fullscreen'])
    expect(passes.slice(1).map(pass => String(pass.effect!.$ref))).toEqual(manifest.effects!.map(entry => String(entry.id)))
    const depthIn = (index: number) => passes[index]!.inputs!.some(input => input.attachment === 'depth')
    expect([1, 2, 3].every(depthIn)).toBe(true); expect([4, 5, 6].some(depthIn)).toBe(false)
    expect(passes[0]!.outputs!.map(output => output.attachment)).toEqual(['color', 'depth'])
    expect(manifest.render!.outputPass).toEqual(cinema2Ref(passes[6]!.id))
    // The floor stands under the rails and dots, and the focus holds the whole depth range of the word.
    expect(effect('reflective-floor').parameters!.floorY).toBe(-3)
    expect(effect('depth-of-field').parameters).toMatchObject({ focusCameraTarget: true, focusRange: expect.any(Number), nearBlur: expect.any(Number) })
    expect(Number(effect('depth-of-field').parameters!.focusRange)).toBeGreaterThanOrEqual(6)
  })

  it('gives every finishing stage a control in Effects, starting on moderate values, so each can be taken to zero', () => {
    const expected = [['Haze', .16, 'volumetric-atmosphere', 'mix'], ['Floor Reflection', .5, 'reflective-floor', 'mix'], ['Depth Focus', .25, 'depth-of-field', 'mix'], ['Light Flares', .08, 'glare', 'mix'],
      ['Film Grain', .07, 'cinematic-finish', 'grain'], ['Lens Fringe', .05, 'cinematic-finish', 'aberration'], ['Vignette', .22, 'cinematic-finish', 'vignette']] as const
    for (const [label, value, typeId, property] of expected) {
      expect(control(label), label).toMatchObject({ type: 'float', designParentGroup: 'effects', defaultValue: value, min: 0 })
      expect(effect(typeId).parameterBindings![property], label).toEqual(cinema2Ref(control(label).id))
    }
    // The strength of a stage at its control's default is what the effect starts with, so there is no jump when the control is first moved.
    expect(control('Reflections')).toMatchObject({ designParentGroup: 'design', group: 'Lighting', defaultValue: 1 })
    expect(manifest.modules![0]!.parameterBindings!.environmentIntensity).toEqual(cinema2Ref(control('Reflections').id))
  })

  it('lights the haze with the palette: the cyan, magenta and red lights take the Left Bank, Right Bank and Red Marker colours', () => {
    const lights = manifest.lighting!.lights.filter(light => String(light.id).includes('-haze-'))
    expect(lights.map(light => light.type)).toEqual(['point', 'point', 'point'])
    expect(lights.map(light => light.controls!.color)).toEqual([cinema2Ref(parallaxCipherParameterId('leftBankColor')), cinema2Ref(parallaxCipherParameterId('rightBankColor')), cinema2Ref(parallaxCipherParameterId('redMarkerColor'))])
    expect(lights.map(light => light.color)).toEqual([[...PARALLAX_CIPHER_PALETTE_DEFAULTS.leftBankColor], [...PARALLAX_CIPHER_PALETTE_DEFAULTS.rightBankColor], [...PARALLAX_CIPHER_PALETTE_DEFAULTS.redMarkerColor]])
  })

  it('opens the lens on a kick and a drop, and flares and thickens the air on the drop, through the preset\'s own controls', () => {
    const rules = manifest.choreography!.rules
    const hits = (signal: string, property: string) => rules.some(rule => rule.source.signal === signal && rule.actions.some(action => (action.target as { property?: string }).property === property))
    expect(hits('kick', 'aberration')).toBe(true); expect(hits('drop', 'aberration')).toBe(true); expect(hits('drop', 'mix')).toBe(true)
    const kick = rules.find(rule => rule.id.includes('kick-lensfringe'))!
    expect(kick.conditions!.some(condition => condition.kind === 'not-silent')).toBe(true)
    const drop = rules.find(rule => rule.id.includes('drop-lensfringe'))!
    expect(drop.conditions!.some(condition => condition.kind === 'not-silent')).toBeFalsy()
  })

  it('still compiles, and keeps Glyph Sphere on the shared crate finish', () => {
    const result = compileCinema2NativePreset(manifest)
    if (!result.ok) throw new Error(result.diagnostics.map(entry => entry.message).join('\n'))
    const sphere = CINEMA2_CRATE_PRESET_MANIFESTS.find(preset => preset.id === 'drmvyz.cinema2.crate-glyph-sphere')
    if (sphere) expect(sphere.effects!.map(entry => entry.typeId)).toEqual(['hdr-bloom', 'cinematic-finish'])
  })
})
