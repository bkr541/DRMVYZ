import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2LayerId,
  type Cinema2ModuleId,
  type Cinema2ModuleTypeId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2RenderPassId,
  type Cinema2SceneNodeId,
} from '../contracts/Cinema2NativePresetManifest'

export const CINEMA2_REFERENCE_VISUAL_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.reference-visual')
export const CINEMA2_REFERENCE_VISUAL_OUTPUT_ENABLED_ID = cinema2StableId<Cinema2ParameterId>('reference-output-enabled')

const REFERENCE_ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('reference-root')
const REFERENCE_MODULE_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('reference-fullscreen-node')
const REFERENCE_MODULE_ID = cinema2StableId<Cinema2ModuleId>('reference-fullscreen')
const FULLSCREEN_SHADER_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('fullscreen-shader')
const REFERENCE_LAYER_ID = cinema2StableId<Cinema2LayerId>('reference-layer')
const REFERENCE_RENDER_PASS_ID = cinema2StableId<Cinema2RenderPassId>('reference-scene-output')

const REFERENCE_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_audioOverallEnergy;
uniform float u_audioOverallEnergyAvailable;
out vec4 outColor;

void main() {
  vec2 centered = v_uv * 2.0 - 1.0;
  centered.x *= u_resolution.x / max(u_resolution.y, 1.0);

  float available = step(0.5, u_audioOverallEnergyAvailable);
  float energy = mix(0.18, clamp(u_audioOverallEnergy, 0.0, 1.0), available);
  float radius = length(centered);
  float ring = 1.0 - smoothstep(0.015, 0.05, abs(radius - (0.38 + energy * 0.08)));
  float crosshair = (1.0 - smoothstep(0.0, 0.008, abs(centered.x)))
    + (1.0 - smoothstep(0.0, 0.008, abs(centered.y)));
  float breathing = 0.82 + 0.18 * sin(u_time * 0.7);
  float reactive = mix(0.28, 1.0, energy) * breathing;

  vec3 background = vec3(0.025, 0.03, 0.04);
  vec3 guide = vec3(0.16, 0.22, 0.27) * min(crosshair, 1.0);
  vec3 signal = vec3(0.28, 0.72, 0.78) * ring * reactive;
  outColor = vec4(background + guide * 0.22 + signal, 1.0);
}
`

/**
 * First production-facing native Cinema 2.0 visual. It intentionally stays
 * diagnostic: one module, one node, one layer, one Design parameter and one
 * read-only continuous Audio Intelligence response.
 */
export const CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_REFERENCE_VISUAL_PRESET_ID,
  revision: 1,
  metadata: Object.freeze({
    name: 'Reference Visual',
    description: 'Minimal native Cinema 2.0 vertical-slice diagnostic.',
    tags: Object.freeze(['reference', 'diagnostic']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native fullscreen Stage output.' }),
    Object.freeze({ id: 'audio.features' as const, requirement: 'optional' as const, purpose: 'Continuous overall-energy diagnostic response when authoritative audio is available.' }),
  ]),
  parameters: Object.freeze([Object.freeze({
    id: CINEMA2_REFERENCE_VISUAL_OUTPUT_ENABLED_ID,
    label: 'Reference Output',
    description: 'Show or hide the diagnostic output.',
    type: 'boolean' as const,
    defaultValue: true,
    section: 'Design',
    group: 'Reference Visual',
    order: 0,
    exposure: 'primary' as const,
    persistence: 'preset' as const,
    reset: 'authored-default' as const,
  })]),
  modules: Object.freeze([Object.freeze({
    id: REFERENCE_MODULE_ID,
    typeId: FULLSCREEN_SHADER_TYPE_ID,
    version: 1,
    enabled: true,
    config: Object.freeze({
      label: 'Cinema 2.0 Reference Visual',
      fragmentSource: REFERENCE_FRAGMENT_SOURCE,
    }),
  })]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({
        id: REFERENCE_ROOT_NODE_ID,
        kind: 'group' as const,
        coordinateSpace: 'normalized-screen' as const,
        visible: true,
      }),
      Object.freeze({
        id: REFERENCE_MODULE_NODE_ID,
        kind: 'module' as const,
        parent: cinema2Ref(REFERENCE_ROOT_NODE_ID),
        module: cinema2Ref(REFERENCE_MODULE_ID),
        visible: true,
      }),
    ]),
  }),
  layers: Object.freeze([Object.freeze({
    id: REFERENCE_LAYER_ID,
    label: 'Reference Visual',
    source: cinema2Ref(REFERENCE_ROOT_NODE_ID),
    visible: true,
    opacity: 1,
    blendMode: 'normal' as const,
    depthPolicy: 'disabled' as const,
    order: 0,
  })]),
  // A tiny authored plan is required here so the persistent Design parameter
  // can visibly gate the real frame-production path without adding choreography.
  render: Object.freeze({
    passes: Object.freeze([Object.freeze({
      id: REFERENCE_RENDER_PASS_ID,
      kind: 'scene' as const,
      layers: Object.freeze([cinema2Ref(REFERENCE_LAYER_ID)]),
      enabledWhen: Object.freeze([Object.freeze({
        kind: 'parameter-equals' as const,
        parameterId: CINEMA2_REFERENCE_VISUAL_OUTPUT_ENABLED_ID,
        value: true,
      })]),
    })]),
  }),
})
