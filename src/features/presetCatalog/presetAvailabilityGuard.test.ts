import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cinema2NativePresetRegistry } from '../../components/vyzualz/cinema2'
import { HEADLINER_PRESETS } from '../../components/vyzualz/react/headliner/HeadlinerEffectCatalog'
import { useReactStore } from '../../stores/reactStore'
import { useNotificationStore } from '../../stores/notificationStore'
import type { PresetMetadataRow } from './presetMetadata'
import { usePresetMetadataStore } from './presetMetadataStore'
import { startPresetAvailabilityGuard } from './presetAvailabilityGuard'

const ids = cinema2NativePresetRegistry.list().filter(manifest => !manifest.metadata.tags?.includes('internal')).map(manifest => manifest.id as string)
const [FIRST, SECOND, THIRD, FOURTH] = ids as [string, string, string, string]
const row = (engine: string, key: string, patch: Partial<PresetMetadataRow>): PresetMetadataRow => ({
  engine_id: engine, preset_key: key, name: null, description: null, category: null, tags: null, display_order: null, publication_status: null,
  store_title: null, store_subtitle: null, store_cover_ref: null, store_preview_ref: null, ...patch,
})
const activeCinema2 = () => useReactStore.getState().cinema2Workspace.activePresetId as string | null
const activate = (presetId: string) => useReactStore.getState().activateCinema2Workspace({ presetId: presetId as never })
const warnings = () => useNotificationStore.getState().events.react.filter(event => event.title === 'Preset unavailable').map(event => event.message)

let stopGuard: () => void = () => undefined
beforeEach(() => {
  usePresetMetadataStore.setState({ rows: [], index: new Map(), viewerIsAdmin: false, status: 'ready' })
  useNotificationStore.setState(state => ({ events: { ...state.events, react: [] } }))
  expect(activate(SECOND).ok).toBe(true)
  stopGuard = startPresetAvailabilityGuard()
})
afterEach(() => stopGuard())

describe('publication status and the off switch in the running app (CAT-01)', () => {
  it('will not start a preset an admin has switched off, has archived or has not released, and says why', () => {
    usePresetMetadataStore.getState().setRows([
      row('cinema2', FIRST, { disabled: true, disabled_reason: 'being fixed' }),
      row('cinema2', THIRD, { publication_status: 'draft' }),
    ])
    const refused = activate(FIRST)
    expect(refused.ok).toBe(false)
    expect(activeCinema2()).toBe(SECOND)
    expect(activate(THIRD).ok).toBe(false)
    expect(warnings().some(message => message.endsWith('switched off for now: being fixed'))).toBe(true)
  })

  it('lets admins use Designing and Draft presets', () => {
    usePresetMetadataStore.getState().setRows([row('cinema2', THIRD, { publication_status: 'draft' })])
    usePresetMetadataStore.getState().setViewerIsAdmin(true)
    expect(activate(THIRD).ok).toBe(true)
    expect(activeCinema2()).toBe(THIRD)
  })

  it('replaces a preset that is switched off while it is on stage', () => {
    expect(activate(FOURTH).ok).toBe(true)
    usePresetMetadataStore.getState().setRows([row('cinema2', FOURTH, { disabled: true })])
    expect(activeCinema2()).not.toBe(FOURTH)
    expect(activeCinema2()).toBe(SECOND)
    expect(warnings()).toHaveLength(1)
  })

  it('catches a route that bypasses the activation actions (a saved project, a pad, a cue) and goes back to the last usable preset', () => {
    usePresetMetadataStore.getState().setRows([row('cinema2', FIRST, { publication_status: 'archived' })])
    const workspace = useReactStore.getState().cinema2Workspace
    useReactStore.setState({ cinema2Workspace: { ...workspace, activePresetId: FIRST as never } })
    expect(activeCinema2()).toBe(SECOND)
  })

  it('keeps the current HEADLINER effect when an unavailable one is chosen, and falls back to Clean Playback if the active one is switched off', () => {
    const [effectA, effectB] = HEADLINER_PRESETS.map(preset => preset.id)
    useReactStore.getState().setHeadlinerSettings({ presetId: effectA as never })
    usePresetMetadataStore.getState().setRows([row('headliner', effectB!, { disabled: true })])
    useReactStore.getState().setHeadlinerSettings({ presetId: effectB as never })
    expect(useReactStore.getState().headlinerSettings.presetId).toBe(effectA)
    usePresetMetadataStore.getState().setRows([row('headliner', effectA!, { disabled: true }), row('headliner', effectB!, { disabled: true })])
    expect(useReactStore.getState().headlinerSettings.presetId).toBeNull()
  })

  it('brings a preset back as soon as it is switched on again', () => {
    usePresetMetadataStore.getState().setRows([row('cinema2', FIRST, { disabled: true })])
    expect(activate(FIRST).ok).toBe(false)
    usePresetMetadataStore.getState().setRows([row('cinema2', FIRST, { disabled: false, publication_status: 'published' })])
    expect(activate(FIRST).ok).toBe(true)
  })
})
