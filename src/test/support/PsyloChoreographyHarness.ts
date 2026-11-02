import { Cinema2AudioIntelligenceBridge } from '../../components/vyzualz/cinema2/audio/Cinema2AudioIntelligenceBridge'
import { Cinema2PsyloAudio, readPsyloChoreography } from '../../components/vyzualz/cinema2/modules/psylo/Cinema2PsyloAudio'
import type { Cinema2ModuleFrameReadContext } from '../../components/vyzualz/cinema2/modules/Cinema2ModuleContracts'
import { compileCinema2NativePreset } from '../../components/vyzualz/cinema2/presets/Cinema2PresetCompiler'
import { CINEMA2_PSYLO_PRESET_MANIFEST } from '../../components/vyzualz/cinema2/presets/Cinema2PsyloPreset'
import { Cinema2FinalValueResolver } from '../../components/vyzualz/cinema2/parameters/Cinema2TargetRuntime'
import { Cinema2ParameterState } from '../../components/vyzualz/cinema2/parameters/Cinema2ParameterState'
import { Cinema2ChoreographyRuntime } from '../../components/vyzualz/cinema2/choreography/Cinema2ChoreographyRuntime'
import { Cinema2VisualDirector } from '../../components/vyzualz/cinema2/director/Cinema2VisualDirector'
import { Cinema2PsyloDirector } from '../../components/vyzualz/cinema2/modules/psylo/Cinema2PsyloDirector'
import { psyloMusicFixture, type PsyloFixtureOptions } from './PsyloMusicFixture'

/** Real manifest, compiler, shared audio/choreography and final module targets. */
export function psyloChoreographyHarness(withDirector = false) {
  const compiled = compileCinema2NativePreset(CINEMA2_PSYLO_PRESET_MANIFEST)
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
  const state = new Cinema2ParameterState(compiled.plan.parameters)
  const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, { resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId) })
  const choreography = new Cinema2ChoreographyRuntime(compiled.plan, state, resolver)
  const parameters = {
    get: (key: string) => {
      const target = compiled.plan.targets.targets.find(t => t.kind === 'module' && t.property === key)!
      const result = resolver.resolve(target.id)
      return result.ok ? result.value : undefined
    },
    getAuthored: () => undefined, resolve: () => null,
  }
  let upstream = psyloMusicFixture({ timeSec: 0, frameId: 1 }), sequence = 1, previous: number | null = null
  const bridge = new Cinema2AudioIntelligenceBridge({ getFrame: () => upstream,
    getPublicationMeta: () => ({ sequence, publisherId: 'psylo-test', kind: 'frame', publishedAtMs: 0 }) })
  const delivery = new Cinema2PsyloAudio(), director = new Cinema2VisualDirector(), directorConsumer = new Cinema2PsyloDirector()
  const publish = (options: Partial<PsyloFixtureOptions> = {}, amount = 1, paused = false, reset?: boolean) => {
    upstream = psyloMusicFixture({ timeSec: sequence * .1, frameId: ++sequence, ...options })
    const frame: Cinema2ModuleFrameReadContext = {
      frameId: sequence, timestampMs: upstream.timeSec * 1000, elapsedTimeSec: upstream.timeSec, deltaTimeSec: paused ? 0 : Math.max(0, upstream.timeSec - (previous ?? upstream.timeSec)),
      viewport: { width: 1280, height: 720, dpr: 1 }, contextGeneration: 1, audio: bridge.capture(sequence), director: null,
      transport: { sourcePresent: true, playing: !paused, analysisActive: true, animationActive: !paused, paused, trackId: upstream.trackId!, timeSec: upstream.timeSec },
    }
    if (withDirector) frame.director = director.capture(frame.audio!)
    choreography.update(frame)
    const channels = readPsyloChoreography(parameters)
    const output = delivery.update(frame, amount, previous, reset ?? frame.audio!.discontinuity.occurred, false, channels)
    const directed = directorConsumer.apply(frame, amount, output, channels, reset ?? frame.audio!.discontinuity.occurred)
    const old = previous; previous = upstream.timeSec
    return { frame, output, directed, channels, previous: old }
  }
  return { publish, delivery, choreography, state, resolver, directorConsumer, targets: compiled.plan.targets.targets }
}
