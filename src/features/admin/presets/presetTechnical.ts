import { cinema2NativePresetRegistry } from '../../../components/vyzualz/cinema2'
import type { PresetManagerRecord } from '../../../components/vyzualz/presetManager/presetManagerCatalog'

const ACTIVATION_LABEL: Record<PresetManagerRecord['activation'], string> = {
  cinema2: 'Cinema 2.0 native preset', react: 'React engine preset', canvas: 'CANVAS preset', laserDmxBeamMatrix: 'LaserDMX beam matrix',
  laserDmxPerformance: 'LaserDMX performance', laserDmxTemplate: 'LaserDMX Show Director template', headliner: 'HEADLINER effect',
}

export const activationLabel = (record: Pick<PresetManagerRecord, 'activation'>) => ACTIVATION_LABEL[record.activation]

/** The version and compatibility the app knows for a preset. Only Cinema 2.0 presets carry them (a revision, and the capabilities they require). */
export function presetVersionInfo(record: Pick<PresetManagerRecord, 'activation' | 'sourceId'>): { version: string; compatibility: string } {
  if (record.activation !== 'cinema2') return { version: '—', compatibility: '—' }
  const manifest = cinema2NativePresetRegistry.get(record.sourceId as never)
  if (!manifest) return { version: '—', compatibility: '—' }
  const required = (manifest.capabilities ?? []).filter(capability => capability.requirement === 'required').map(capability => capability.id)
  return { version: `Revision ${manifest.revision}`, compatibility: required.length > 0 ? `Requires ${required.join(', ')}` : 'No required capabilities' }
}
