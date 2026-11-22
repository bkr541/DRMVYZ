import { useState } from 'react'
import { AppIcon } from '../../../components/shared/icons/AppIcon'
import type { Cinema2PresetId } from '../../../components/vyzualz/cinema2'
import { presetArtworkBackdrop, PresetLibraryCard } from '../../../components/vyzualz/presetManager/PresetLibraryCard'
import { Cinema2Stage } from '../../../components/vyzualz/react/Cinema2Stage'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { UnderlineTabs } from '../../../components/vyzualz/react/controls/UnderlineTabs'
import { ReactPresetArtwork, ReactPresetCard } from '../../../components/vyzualz/react/ReactPresetCard'
import { StatusBadge, type ShownPreset } from './PresetCatalogCards'
import { type AdminPreset, type CatalogPack } from './presetAdmin'
import { activationLabel, presetVersionInfo } from './presetTechnical'

const CAN_HOST_CINEMA2_STAGE = typeof window !== 'undefined' && 'WebGL2RenderingContext' in window
const NOOP = () => undefined
type StageTab = 'preview' | 'inapp'
const STAGE_TABS = [{ id: 'preview', label: 'PREVIEW' }, { id: 'inapp', label: 'IN THE APP' }] as const

interface Props {
  preset: AdminPreset | null
  shown: ShownPreset | null
  packs: readonly CatalogPack[]
  /** The admin has unsaved changes to this preset. */
  changed: boolean
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="adm-fact"><dt>{label}</dt><dd>{children}</dd></div>
}

/**
 * The centre window. PREVIEW shows what the preset looks like: its artwork, or, for a Cinema 2.0 preset, the real preset running when the admin starts it
 * (never on its own, so moving through 150 presets stays quiet). IN THE APP shows the same two cards users see in their preset lists, with the admin's
 * unsaved name and description applied, so an edit can be judged before it is saved.
 */
export function PresetCatalogStage({ preset, shown, packs, changed }: Props) {
  const [tab, setTab] = useState<StageTab>('preview')
  const [live, setLive] = useState(false)
  const record = shown?.record
  const cinema2 = record?.activation === 'cinema2'
  const canPlay = Boolean(cinema2 && CAN_HOST_CINEMA2_STAGE)
  const version = record ? presetVersionInfo(record) : null
  const memberOf = preset ? packs.filter(pack => preset.packIds.includes(pack.id)) : []

  return (
    <div className="pmv-stage fw-surface adm-stage" aria-label="Preset preview workspace">
      <UnderlineTabs tabs={STAGE_TABS} activeTab={tab} onChange={setTab} ariaLabel="Preset preview views" className="pmv-stage-tabs" />
      {!preset || !shown || !record ? (
        <div className="pmv-preview-group adm-stage-empty"><p className="adm-empty">Select a preset to see it here.</p></div>
      ) : tab === 'preview' ? (
        <div className="pmv-preview-group adm-stage-preview" role="group" aria-label={`${shown.name} preview`}>
          <div className="adm-preview-visual">
            {live && canPlay
              ? <div className="pmv-preview-live"><Cinema2Stage key={record.sourceId} presetId={record.sourceId as Cinema2PresetId} /></div>
              : <ReactPresetArtwork appearance="frame" id={record.sourceId} backdrop={presetArtworkBackdrop(record)} className="adm-preview-art" />}
            {canPlay && (
              <IconChipButton className="adm-preview-play" tone={live ? 'primary' : 'default'} aria-pressed={live} onClick={() => setLive(value => !value)}
                icon={<AppIcon kind={live ? 'pause' : 'play'} size={12} color="currentColor" />}>{live ? 'Stop live preview' : 'Play live preview'}</IconChipButton>
            )}
          </div>
          <div className="adm-preview-summary">
            <div className="adm-preview-title">
              <h2>{shown.name}{changed ? <span className="adm-edited" title="Has changes that are not saved yet"> •</span> : null}</h2>
              <StatusBadge status={preset.status} />
            </div>
            <p className="adm-preview-description">{shown.description || 'No description.'}</p>
            <dl className="adm-facts">
              <Fact label="Engine">{record.engineName}</Fact>
              <Fact label="Category">{preset.category}</Fact>
              <Fact label="Type">{activationLabel(record)}</Fact>
              <Fact label="Version">{version?.version ?? '—'}</Fact>
              <Fact label="Packs">{memberOf.map(pack => pack.name).join(', ') || 'None'}</Fact>
              <Fact label="Display order">{preset.order ?? 'Shipped order'}</Fact>
              <Fact label="Capabilities">{[record.hasCamera && 'Camera', record.canIntegrateUserMedia && 'User media', record.is3dEnvironment && '3D'].filter(Boolean).join(' · ') || '—'}</Fact>
              <Fact label="Last changed">{preset.row?.updated_at ? new Date(preset.row.updated_at).toLocaleString() : 'As shipped'}</Fact>
            </dl>
          </div>
        </div>
      ) : (
        <div className="pmv-preview-group adm-inapp" role="group" aria-label={`${shown.name} as users see it`}>
          <section aria-label="In the preset library">
            <h3 className="adm-inapp-title">In the preset library</h3>
            <div className="adm-inapp-list"><PresetLibraryCard preset={record} active={false} favorite={false} onSelect={NOOP} onToggleFavorite={NOOP} /></div>
          </section>
          <section aria-label="In the preset grid">
            <h3 className="adm-inapp-title">In the preset grid</h3>
            <div className="adm-inapp-grid">
              <ReactPresetCard id={record.sourceId} title={shown.name} description={shown.description} backdrop={presetArtworkBackdrop(record)} activateLabel={`${shown.name} as shown in the grid`} onActivate={NOOP} />
            </div>
          </section>
          <p className="adm-muted">Shown with your unsaved name and description. Category and tags are not shown on these cards.</p>
        </div>
      )}
    </div>
  )
}
