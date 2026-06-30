import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { Collapsible, NumberInputRow, SelectRow, TextInputRow, ToggleRow } from './ReactControlRows'
import {
  ALL_PRODUCTION_FIXTURE_KINDS,
  normalizeProductionLook,
  normalizeProductionLookTransition,
  type ProductionFixtureKind,
  type ProductionLook,
  type ProductionLookTransitionMode,
} from './LaserDmxProductionRig'
import { beginProductionLookTransition } from './renderers/LaserDmxProductionLookEngine'

const TRANSITION_OPTIONS: Array<{ value: ProductionLookTransitionMode; label: string }> = [
  { value: 'cut', label: 'Immediate Cut' },
  { value: 'linearFade', label: 'Linear Fade' },
  { value: 'easedFade', label: 'Eased Fade' },
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'blackout', label: 'Blackout Transition' },
  { value: 'shutteredPrePosition', label: 'Shuttered Pre-Position + Reveal' },
  { value: 'colorOnly', label: 'Color Only' },
  { value: 'movementOnly', label: 'Movement Only' },
]

const FIXTURE_KIND_LABELS: Record<ProductionFixtureKind, string> = {
  laserProjector: 'Lasers',
  movingHeadBeam: 'Moving Beams',
  movingHeadSpot: 'Moving Spots',
  movingHeadWash: 'Moving Washes',
  staticWash: 'Static Washes',
  strobe: 'Strobes',
  blinder: 'Blinders',
  ledBar: 'LED Bars',
  hazer: 'Haze Fixtures',
  fogger: 'Fog Emitters',
  cryoJet: 'Cryogenic Jets',
}

function sameLook(a: ProductionLook | null, b: ProductionLook | null): boolean {
  if (!a || !b) return a === b
  return JSON.stringify(a) === JSON.stringify(b)
}

export function LaserDmxLookEditor() {
  const {
    settings,
    setSettings,
    createLook,
    duplicateLook,
    updateLook,
    updateLookFromCurrent,
    activateLook,
    reorderLook,
    deleteLook,
  } = useReactStore(useShallow(state => ({
    settings: state.laserDmxSettings,
    setSettings: state.setLaserDmxSettings,
    createLook: state.createLaserDmxProductionLook,
    duplicateLook: state.duplicateLaserDmxProductionLook,
    updateLook: state.updateLaserDmxProductionLook,
    updateLookFromCurrent: state.updateLaserDmxProductionLookFromCurrent,
    activateLook: state.activateLaserDmxProductionLook,
    reorderLook: state.reorderLaserDmxProductionLook,
    deleteLook: state.deleteLaserDmxProductionLook,
  })))
  const looks = settings.productionLooks ?? []
  const activeLook = looks.find(look => look.id === settings.activeProductionLookId) ?? looks[0] ?? null
  const [selectedId, setSelectedId] = useState(activeLook?.id ?? '')
  const selectedLook = looks.find(look => look.id === selectedId) ?? activeLook
  const [draft, setDraft] = useState<ProductionLook | null>(selectedLook ?? null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [familyDurationKind, setFamilyDurationKind] = useState<ProductionFixtureKind>('laserProjector')

  useEffect(() => {
    if (!selectedLook) {
      setDraft(null)
      return
    }
    setSelectedId(selectedLook.id)
    setDraft(normalizeProductionLook(selectedLook))
    setConfirmDelete(false)
  }, [selectedLook])

  const presentKinds = useMemo(() => {
    const set = new Set(settings.fixtures.map(fixture => fixture.fixtureKind).filter(Boolean))
    return ALL_PRODUCTION_FIXTURE_KINDS.filter(kind => set.has(kind))
  }, [settings.fixtures])
  const dirty = !sameLook(draft, selectedLook ?? null)

  function patchDraft(patch: Partial<ProductionLook>) {
    if (!draft) return
    setDraft(normalizeProductionLook({ ...draft, ...patch }))
  }

  function toggleKind(kind: ProductionFixtureKind, included: boolean) {
    if (!draft) return
    const fixtureKinds = included
      ? [...new Set([...draft.scope.fixtureKinds, kind])]
      : draft.scope.fixtureKinds.filter(candidate => candidate !== kind)
    patchDraft({ scope: { ...draft.scope, fixtureKinds } })
  }

  function toggleGroup(groupId: string, included: boolean) {
    if (!draft) return
    const groupIds = included
      ? [...new Set([...draft.scope.groupIds, groupId])]
      : draft.scope.groupIds.filter(candidate => candidate !== groupId)
    patchDraft({ scope: { ...draft.scope, groupIds } })
  }

  function create() {
    const id = createLook()
    setSelectedId(id)
  }

  function save() {
    if (!draft) return
    updateLook(draft.id, draft)
  }

  function duplicate() {
    if (!draft) return
    const id = duplicateLook(draft.id)
    if (id) setSelectedId(id)
  }

  function preview() {
    if (!draft) return
    const result = beginProductionLookTransition(settings, draft)
    setSettings(result.settings)
  }

  function updateTransition(patch: Partial<ProductionLook['transition']>) {
    if (!draft) return
    patchDraft({ transition: normalizeProductionLookTransition({ ...draft.transition, ...patch }) })
  }

  return (
    <Collapsible label={`Production Looks (${looks.length})${dirty ? ' • Unsaved' : ''}`} defaultOpen>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        <button type="button" className="rv-glyph-upload-btn" onClick={create}>+ Capture Current</button>
      </div>

      {looks.length === 0 || !draft ? (
        <div className="rv-ctrl-info">Capture the current rig to create the first coordinated stage-production Look.</div>
      ) : (
        <>
          <SelectRow
            label="Selected Look"
            value={draft.id}
            onChange={setSelectedId}
            options={looks.map(look => ({ value: look.id, label: look.name }))}
          />
          <TextInputRow label="Look Name" value={draft.name} onChange={name => patchDraft({ name })} />
          <SelectRow
            label="Omitted State"
            value={draft.omissionMode}
            onChange={omissionMode => patchDraft({ omissionMode: omissionMode as ProductionLook['omissionMode'] })}
            options={[
              { value: 'preserve', label: 'Preserve Unspecified State' },
              { value: 'resetIncluded', label: 'Reset Included Fixtures First' },
            ]}
            description="Partial Looks preserve everything outside their scope. Reset Included only neutralizes selected fixtures before applying stored values."
          />

          <Collapsible label="Included Systems" defaultOpen={false}>
            <ToggleRow label="Global Dimmer / Shutter State" value={draft.scope.includeGlobal} onChange={includeGlobal => patchDraft({ scope: { ...draft.scope, includeGlobal } })} />
            <ToggleRow label="Atmosphere / Effect Arming" value={draft.scope.includeAtmosphere} onChange={includeAtmosphere => patchDraft({ scope: { ...draft.scope, includeAtmosphere } })} />
            <ToggleRow label="Stage Camera" value={draft.scope.includeStage} onChange={includeStage => patchDraft({ scope: { ...draft.scope, includeStage } })} />
            {presentKinds.map(kind => (
              <ToggleRow
                key={kind}
                label={FIXTURE_KIND_LABELS[kind]}
                value={draft.scope.fixtureKinds.includes(kind)}
                onChange={included => toggleKind(kind, included)}
              />
            ))}
            {(settings.productionGroups ?? []).map(group => (
              <ToggleRow
                key={group.id}
                label={`Group · ${group.name}`}
                value={draft.scope.groupIds.includes(group.id)}
                onChange={included => toggleGroup(group.id, included)}
              />
            ))}
          </Collapsible>

          <Collapsible label="Transition Defaults" defaultOpen={false}>
            <SelectRow
              label="Transition"
              value={draft.transition.mode}
              onChange={mode => updateTransition({ mode: mode as ProductionLookTransitionMode })}
              options={TRANSITION_OPTIONS}
            />
            <NumberInputRow label="Duration" value={draft.transition.durationMs} onChange={durationMs => updateTransition({ durationMs })} min={0} max={60000} step={50} unit="ms" />
            <SelectRow
              label="Easing"
              value={draft.transition.easing}
              onChange={easing => updateTransition({ easing: easing as ProductionLook['transition']['easing'] })}
              options={[
                { value: 'linear', label: 'Linear' },
                { value: 'easeIn', label: 'Ease In' },
                { value: 'easeOut', label: 'Ease Out' },
                { value: 'easeInOut', label: 'Ease In / Out' },
              ]}
            />
            <NumberInputRow label="Discrete Switch" value={draft.transition.switchPoint} onChange={switchPoint => updateTransition({ switchPoint })} min={0} max={1} step={0.05} />
            <ToggleRow label="Reveal Output on Activation" value={draft.transition.revealOutput} onChange={revealOutput => updateTransition({ revealOutput })} />
            <SelectRow
              label="Fixture Family Override"
              value={familyDurationKind}
              onChange={value => setFamilyDurationKind(value as ProductionFixtureKind)}
              options={ALL_PRODUCTION_FIXTURE_KINDS.map(kind => ({ value: kind, label: FIXTURE_KIND_LABELS[kind] }))}
            />
            <NumberInputRow
              label="Family Duration"
              value={draft.transition.fixtureFamilyDurationsMs[familyDurationKind] ?? draft.transition.durationMs}
              onChange={durationMs => updateTransition({
                fixtureFamilyDurationsMs: {
                  ...draft.transition.fixtureFamilyDurationsMs,
                  [familyDurationKind]: durationMs,
                },
              })}
              min={0}
              max={60000}
              step={50}
              unit="ms"
            />
          </Collapsible>

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
            <button type="button" className="rv-glyph-upload-btn" onClick={() => activateLook(draft.id)}>Activate Saved</button>
            <button type="button" className="rv-glyph-upload-btn" onClick={preview}>Preview Draft</button>
            <button type="button" className="rv-glyph-upload-btn" onClick={save} disabled={!dirty}>Save Edits</button>
            <button type="button" className="rv-glyph-upload-btn" onClick={() => updateLookFromCurrent(draft.id)}>Update from Current</button>
            <button type="button" className="rv-glyph-upload-btn" onClick={duplicate}>⧉ Duplicate</button>
            <button type="button" className="rv-glyph-upload-btn" aria-label={`Move ${draft.name} earlier`} onClick={() => reorderLook(draft.id, -1)}>↑</button>
            <button type="button" className="rv-glyph-upload-btn" aria-label={`Move ${draft.name} later`} onClick={() => reorderLook(draft.id, 1)}>↓</button>
            <button
              type="button"
              className="rv-glyph-upload-btn rv-glyph-upload-btn--danger"
              onClick={() => {
                if (confirmDelete) deleteLook(draft.id)
                else setConfirmDelete(true)
              }}
            >
              {confirmDelete ? 'Confirm Delete' : 'Delete'}
            </button>
          </div>
          <div className="rv-ctrl-info" role="status">
            {dirty ? 'Unsaved Look edits. Preview Draft does not save them.' : `Saved Look · ${draft.source ?? 'authored'}`}
          </div>
        </>
      )}
    </Collapsible>
  )
}
