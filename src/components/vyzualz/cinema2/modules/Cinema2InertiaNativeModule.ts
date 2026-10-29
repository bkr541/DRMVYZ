import { cinema2StableId, type Cinema2Color, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleCreateContext, Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { INERTIA_PARTS, INERTIA_PROOF_POSES } from './inertia/Cinema2InertiaGeometry'
import { Cinema2InertiaRenderer } from './inertia/Cinema2InertiaRenderer'
import { Cinema2InertiaMotion, INERTIA_PATTERNS } from './inertia/Cinema2InertiaMotion'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS } from './Cinema2AfterhoursNativeModule'
import { Cinema2InertiaAudio, applyInertiaAudio } from './inertia/Cinema2InertiaAudio'
import { selectCinema2MainframeAudio } from './mainframe/Cinema2MainframeAudioDelivery'

export const CINEMA2_INERTIA_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('inertia-native')

/** Shared musical targets modulate the authored native sculpture; Auto Performance is a later phase. */
export const cinema2InertiaNativeModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = {
  typeId: CINEMA2_INERTIA_NATIVE_MODULE_TYPE_ID,
  version: 1,
  create(context: Cinema2ModuleCreateContext) {
    const motion = new Cinema2InertiaMotion()
    const audio = new Cinema2InertiaAudio()
    const renderer = context.resources.acquire('inertia:static-sculpture:v1', 'Cinema2InertiaRenderer',
      gl => new Cinema2InertiaRenderer(gl), value => value.dispose())
    return {
      lifecycle: { update() {}, dispose() {} },
      render: { providers: [{
        id: `${context.module.id}:sculpture`, moduleId: context.module.id, intent: 'world',
        execute(execution) {
          if (!execution.camera) throw new Error('Inertia requires the shared world camera')
          const number = context.parameters.get('intensity')
          const accepted = { ...execution.frame, audio: selectCinema2MainframeAudio(execution.frame.audio, execution.frame.transport?.trackId) }
          const amount = numeric(context, 'motionAmount', 0.65, 0, 1), deformation = numeric(context, 'deformation', 0.45, 0, 1)
          const damping = numeric(context, 'damping', 0.65, 0, 1)
          const response = audio.update(accepted, name => numeric(context, name, 0, 0, 1), numeric(context, 'audioResponse', 0.65, 0, 1), amount, deformation, damping)
          const nativePose = motion.update(accepted, {
            pattern: enumValue(context, 'pattern', INERTIA_PATTERNS.map(p => p[0]), 'reference-cycle'),
            sync: context.parameters.get('bpmSync') !== false,
            speed: numeric(context, 'motionSpeed', 1, 0.25, 2), amount, deformation, damping,
            patternChange: context.parameters.get('patternChange') === true,
            trigger: enumValue(context, 'trigger', CINEMA2_AFTERHOURS_TRIGGER_IDS, 'bar4'),
            editRevision: context.parameters.getEditRevision?.('pattern') ?? 0,
            autoPerformance: context.parameters.get('autoPerformance') === true,
            audioResponse: numeric(context, 'audioResponse', 0.65, 0, 1),
            buildValue: numeric(context, 'buildCompression', 0, 0, 1),
            resolvePerformance: selection => {
              const target = context.parameters.resolve('performancePattern')?.target
              if (!target) return selection.pattern
              const resolved = context.targets.resolve(target.id, [{
                contributorId: 'inertia.performance', operation: 'replace', value: selection.pattern,
                priority: 10, ...(selection.eventId ? { eventId: selection.eventId } : {}),
              }])
              return resolved.ok && typeof resolved.value === 'string' && INERTIA_PATTERNS.some(p => p[0] === resolved.value)
                ? resolved.value as typeof selection.pattern : selection.pattern
            },
          })
          renderer.draw({
            viewProjection: execution.camera.viewProjectionMatrix,
            width: execution.width, height: execution.height,
            dpr: execution.width / Math.max(1, execution.frame.viewport.width),
            quality: execution.lightingEnvironment?.quality ?? 'high',
            pose: enumValue(context, 'proofPose', INERTIA_PROOF_POSES, 'coherent'),
            part: enumValue(context, 'proofPart', INERTIA_PARTS, 'all'),
            intensity: typeof number === 'number' && Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0.7,
            motion: applyInertiaAudio(nativePose, response), displacement: response.displacement, sparkle: response.sparkle,
            cageSize: numeric(context, 'cageSize', 1, 0.65, 1.1), coreSize: numeric(context, 'coreSize', 1, 0.65, 1.4) * (1 + response.corePulse),
            density: numeric(context, 'latticeDensity', 0.8, 0.35, 1), pointSize: numeric(context, 'pointSize', 1, 0.5, 2),
            anchorSize: numeric(context, 'anchorSize', 1, 0.4, 1.6),
            lattice: color(context, 'latticeColor', 176 / 255), core: color(context, 'coreColor', 208 / 255),
            anchors: color(context, 'anchorColor', 1), ribs: color(context, 'ribColor', 192 / 255),
          })
          context.resources.reportGpuBytes(renderer.estimateGpuBytes())
        },
      }] },
    }
  },
}

function numeric(context: Cinema2ModuleCreateContext, name: string, fallback: number, min: number, max: number): number {
  const value = context.parameters.get(name)
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
}

function enumValue<T extends string>(context: Cinema2ModuleCreateContext, name: string, options: readonly T[], fallback: T): T {
  const value = context.parameters.get(name)
  return options.includes(value as T) ? value as T : fallback
}

function color(context: Cinema2ModuleCreateContext, name: string, fallback: number): Cinema2Color {
  const value = context.parameters.get(name)
  return Array.isArray(value) && value.length === 4 && value.every(v => typeof v === 'number' && Number.isFinite(v))
    ? value as unknown as Cinema2Color : [fallback, fallback, fallback, 1]
}
