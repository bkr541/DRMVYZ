import { Cinema2ElevhatePerformance } from './elevhate/Cinema2ElevhatePerformance'
import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { Cinema2ElevhateRenderer } from './elevhate/Cinema2ElevhateRenderer'
import { ELEVHATE_PATTERNS } from './elevhate/Cinema2ElevhateGeometry'

export const CINEMA2_ELEVHATE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('elevhate-native')
export const cinema2ElevhateNativeModuleDefinition: Cinema2ModuleTypeDefinition = {
  typeId: CINEMA2_ELEVHATE_MODULE_TYPE_ID, version: 1,
  create(context) {
    const renderers = ([4, 5, 7] as const).map(radius => context.resources.acquire(
      `elevhate:lattice:${radius}`, 'Cinema2ElevhateRenderer', gl => new Cinema2ElevhateRenderer(gl, radius), value => value.dispose(),
    ))
    context.resources.reportGpuBytes(renderers.reduce((bytes, renderer) => bytes + renderer.estimateGpuBytes(), 0))
    const performance = new Cinema2ElevhatePerformance()
    let from = 0, to = 0, blend = 1
    const number = (name: string, fallback: number) => { const value = context.parameters.get(name); return typeof value === 'number' && Number.isFinite(value) ? value : fallback }
    const color = (name: string, fallback: number): readonly [number, number, number] => {
      const v = context.parameters.get(name)
      return Array.isArray(v) && v.length === 4 ? [v[0], v[1], v[2]] : [fallback, fallback, fallback]
    }
    return {
      lifecycle: { dispose() {}, update(update) {
        performance.update(update)
        const { frame } = update
        const selected = Math.max(0, ELEVHATE_PATTERNS.findIndex(p => p.value === performance.state.pattern))
        if (selected !== to) { from = to; to = selected; blend = 0 }
        blend = Math.min(1, blend + frame.deltaTimeSec / .35)
      } },
      render: { providers: [{ id: `${context.module.id}:world`, moduleId: context.module.id, intent: 'world', execute(execution) {
        if (!execution.camera || !execution.depthAvailable) throw new Error('Elevhate requires shared camera and scene depth.')
        const quality = execution.lightingEnvironment?.quality ?? 'high'
        const renderer = renderers[quality === 'low' ? 0 : quality === 'medium' ? 1 : 2]
        renderer.draw({ viewProjection: execution.camera.viewProjectionMatrix, camera: execution.camera.position,
          opening: number('opening', 4), from, to, blend, phase: performance.state.phase, build: performance.state.build, pressure: performance.state.bass,
          master: performance.state.master, width: number('width', 1.15), haze: number('haze', .004),
          void: color('void', .001), body: color('body', .002), primary: color('primary', 1), junction: color('junction', 1), secondary: color('secondary', .8),
          energy: performance.state.energy, kick: performance.state.kick, snare: performance.state.snare, drop: Math.max(performance.state.drop, performance.state.impact), wave: performance.state.beat, high: performance.state.high, vocal: performance.state.vocal, significance: performance.state.significance })
      } }] },
    }
  },
}
