import { Collapsible, SelectRow, SliderRow, ToggleRow } from '../../../components/vyzualz/react/ReactControlRows'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { AppIcon } from '../../../components/shared/icons/AppIcon'
import { DreamVizTextInput } from '../../../components/vyzualz/react/controls/DreamVizTextInput'
import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { MediaUploadModal } from '../../../components/vyzualz/MediaUploadModal'
import { useMediaStore, type UploadedMedia } from '../../../stores/mediaStore'
import type { BrandAssetPresentation, BrandAssetRole, BrandKitAssetWithMedia, BrandPaletteAnalysis } from '../BrandKitTypes'
import { BRAND_ASSET_BLEND_MODES, BRAND_ASSET_GLOW_MODES, BRAND_ASSET_PLACEMENTS, BRAND_ASSET_ROLES, BRAND_ASSET_VISIBILITY_MODES } from '../BrandKitTypes'
import { DEFAULT_BRAND_ASSET_PRESENTATION } from '../brandKitNormalization'
import { useBrandKitStore } from '../brandKitStore'
import { DialogTitleIcon } from '../../../components/shared/DialogTitleIcon'

const ROLE_LABELS: Record<BrandAssetRole, string> = {
  primaryLogo: 'Primary logo',
  secondaryLogo: 'Secondary logo',
  wordmark: 'Wordmark',
  monogram: 'Monogram',
  keyArt: 'Key art',
  watermark: 'Watermark',
  texture: 'Texture',
  background: 'Background',
  paletteSource: 'Palette source',
}

const ROLE_HINTS: Record<BrandAssetRole, string> = {
  primaryLogo: 'Your main mark for future overlays and identity surfaces.',
  secondaryLogo: 'An alternate logo for different backgrounds.',
  wordmark: 'A full artist or brand name treatment.',
  monogram: 'A compact emblem or initials.',
  keyArt: 'Hero artwork associated with this identity.',
  watermark: 'A subtle transparent mark.',
  texture: 'Surface detail for future visual treatments.',
  background: 'A branded background image.',
  paletteSource: 'Artwork used to extract semantic colors. Multiple sources are supported.',
}

type AssetFilter = 'all' | 'images' | 'svg' | 'logos' | 'transparent' | 'artwork' | 'textures'

const FILTERS: ReadonlyArray<{ id: AssetFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'images', label: 'Images' },
  { id: 'svg', label: 'SVGs' },
  { id: 'logos', label: 'Logos' },
  { id: 'transparent', label: 'Transparent' },
  { id: 'artwork', label: 'Artwork' },
  { id: 'textures', label: 'Textures' },
]

function isSvg(item: UploadedMedia): boolean {
  return item.mediaRole === 'svg' || item.mimeType === 'image/svg+xml' || /\.svg$/i.test(item.name)
}

function matchesFilter(item: UploadedMedia, filter: AssetFilter): boolean {
  if (item.type !== 'image') return false
  switch (filter) {
    case 'images': return !isSvg(item)
    case 'svg': return isSvg(item)
    case 'logos': return item.mediaRole === 'logo' || isSvg(item)
    case 'transparent': return item.mediaRole === 'transparent_element' || item.mediaRole === 'overlay' || item.metadata.hasAlpha === true || isSvg(item)
    case 'artwork': return ['background_image', 'character_art', 'reference', 'other'].includes(item.mediaRole)
    case 'textures': return item.mediaRole === 'texture'
    default: return true
  }
}

function mediaPreview(item: UploadedMedia | null): string | null {
  if (!item) return null
  return item.localThumbnailObjectUrl ?? item.thumbnailUrl ?? item.url ?? null
}

function AssetPreview({ asset, media, onRemove }: {
  asset: BrandKitAssetWithMedia
  media: UploadedMedia | null
  onRemove: () => void
}) {
  const preview = mediaPreview(media)
  const missing = !media && !asset.media
  return (
    <div className={`bk-linked-asset${missing ? ' bk-linked-asset--missing' : ''}`}>
      <div className="bk-linked-asset-preview">
        {preview
          ? <img src={preview} alt="" />
          : <span aria-hidden="true">{missing ? '!' : <AppIcon kind="shape" size={14} />}</span>}
      </div>
      <div className="bk-linked-asset-copy">
        <strong>{media?.title || media?.name || asset.media?.name || 'Missing media'}</strong>
        <span>{missing ? 'This linked media was deleted or is unavailable.' : (media?.mediaRole ?? asset.media?.mediaRole ?? 'image')}</span>
      </div>
      <IconChipButton type="button" className="bk-icon-action" onClick={onRemove} aria-label={`Remove ${media?.name ?? asset.media?.name ?? 'missing asset'}`}><AppIcon kind="close" size={14} /></IconChipButton>
    </div>
  )
}

function AssetPicker({ role, onClose, onPick, onUpload }: {
  role: BrandAssetRole
  onClose: () => void
  onPick: (item: UploadedMedia) => void
  onUpload: () => void
}) {
  const { items, loading, loadError } = useMediaStore(useShallow(state => ({
    items: state.items,
    loading: state.loading,
    loadError: state.loadError,
  })))
  const [filter, setFilter] = useState<AssetFilter>('all')
  const [query, setQuery] = useState('')
  const eligible = useMemo(() => items.filter(item => (
    item.type === 'image'
    && matchesFilter(item, filter)
    && (!query.trim() || `${item.title ?? ''} ${item.name} ${item.tags.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
  )), [items, filter, query])

  return (
    <div className="bk-picker-backdrop" onMouseDown={onClose}>
      <div className="bk-picker" role="dialog" aria-modal="true" aria-labelledby="bk-picker-title" onMouseDown={event => event.stopPropagation()}>
        <div className="bk-picker-header">
          <div>
            <h3 id="bk-picker-title"><DialogTitleIcon name="image" />Choose {ROLE_LABELS[role]}</h3>
          </div>
          <IconChipButton type="button" className="bk-icon-action" onClick={onClose} aria-label="Close asset picker"><AppIcon kind="close" size={14} /></IconChipButton>
        </div>
        <div className="bk-picker-toolbar">
          <label className="bk-search-label">
            <span className="sr-only">Search media</span>
            <DreamVizTextInput value={query} onChange={event => setQuery(event.target.value)} placeholder="Search media…" autoFocus />
          </label>
          <IconChipButton type="button" tone="primary" onClick={onUpload}>Upload media</IconChipButton>
        </div>
        <div className="bk-filter-row" role="group" aria-label="Media filters">
          {FILTERS.map(option => (
            <IconChipButton
              key={option.id}
              type="button"
              tone={filter === option.id ? 'primary' : 'default'}
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
            >{option.label}</IconChipButton>
          ))}
        </div>
        <div className="bk-media-grid">
          {loading && <div className="bk-state" role="status">Loading media library…</div>}
          {!loading && loadError && <div className="bk-state bk-state--error">{loadError}</div>}
          {!loading && !loadError && eligible.length === 0 && (
            <div className="bk-state">No matching uploaded media. Use the existing upload flow to add one.</div>
          )}
          {eligible.map(item => {
            const preview = mediaPreview(item)
            const synced = Boolean(item.dbId)
            return (
              <IconChipButton
                key={item.id}
                type="button"
                className="bk-media-card"
                onClick={() => synced && onPick(item)}
                disabled={!synced}
                title={synced ? item.name : 'Waiting for cloud sync'}
              >
                <div className="bk-media-card-preview">
                  {preview ? <img src={preview} alt="" /> : <span aria-hidden="true"><AppIcon kind="shape" size={14} /></span>}
                </div>
                <strong>{item.title || item.name}</strong>
                <span>{isSvg(item) ? 'SVG' : item.mediaRole.replace(/_/g, ' ')}{synced ? '' : ' · syncing'}</span>
              </IconChipButton>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function BrandKitAssetsEditor({
  kitId,
  assets,
  onPaletteAnalysis,
}: {
  kitId: string
  assets: BrandKitAssetWithMedia[]
  onPaletteAnalysis: (analysis: BrandPaletteAnalysis) => void
}) {
  const { items, loading, loadFromSupabase, storageAvailable, authRequired } = useMediaStore(useShallow(state => ({
    items: state.items,
    loading: state.loading,
    loadFromSupabase: state.loadFromSupabase,
    storageAvailable: state.storageAvailable,
    authRequired: state.authRequired,
  })))
  const { addAsset, updateAsset, removeAsset, syncing } = useBrandKitStore(useShallow(state => ({
    addAsset: state.addAsset,
    updateAsset: state.updateAsset,
    removeAsset: state.removeAsset,
    syncing: state.syncing,
  })))
  const [pickerRole, setPickerRole] = useState<BrandAssetRole | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  useEffect(() => {
    if (!items.length && !loading && storageAvailable && !authRequired) void loadFromSupabase()
  }, [items.length, loading, storageAvailable, authRequired, loadFromSupabase])

  const mediaByDbId = useMemo(
    () => new Map(items.flatMap(item => item.dbId ? [[item.dbId, item] as const] : [])),
    [items],
  )

  async function linkAsset(role: BrandAssetRole, item: UploadedMedia) {
    if (!item.dbId) return
    const existing = assets.filter(asset => asset.role === role)
    if (role !== 'paletteSource') {
      await Promise.all(existing.map(asset => removeAsset(asset.id)))
    } else if (existing.some(asset => asset.mediaItemId === item.dbId)) {
      setPickerRole(null)
      return
    }
    const linked = await addAsset({
      brand_kit_id: kitId,
      media_item_id: item.dbId,
      asset_role: role,
      sort_order: existing.length,
      is_palette_source: role === 'paletteSource',
      presentation: null,
    })
    if (linked && role === 'paletteSource' && item.metadata.paletteAnalysis) {
      onPaletteAnalysis(item.metadata.paletteAnalysis)
    }
    setPickerRole(null)
  }


  const displayAssets = assets.filter(asset => ['primaryLogo', 'secondaryLogo', 'wordmark', 'monogram', 'watermark', 'keyArt'].includes(asset.role))
  const activeDisplayAsset = displayAssets.find(asset => asset.presentation?.enabled) ?? null
  const activePresentation = activeDisplayAsset?.presentation ?? DEFAULT_BRAND_ASSET_PRESENTATION

  async function selectDisplayAsset(assetId: string) {
    await Promise.all(displayAssets.map(asset => updateAsset(asset.id, {
      presentation: asset.id === assetId
        ? { ...(asset.presentation ?? DEFAULT_BRAND_ASSET_PRESENTATION), enabled: true }
        : asset.presentation ? { ...asset.presentation, enabled: false } : null,
    })))
  }

  async function patchDisplayPresentation(patch: Partial<BrandAssetPresentation>) {
    if (!activeDisplayAsset) return
    await updateAsset(activeDisplayAsset.id, {
      presentation: { ...activePresentation, ...patch, enabled: true },
    })
  }

  return (
    <div className="bk-assets-editor">
      <Collapsible label="Canvas branding">
        <SelectRow id="bk-display-asset" label="Display asset" value={activeDisplayAsset?.id ?? ''} disabled={syncing || displayAssets.length === 0} onChange={value => void selectDisplayAsset(value)} options={[{value:'',label:'Disabled'}, ...displayAssets.map(asset => ({value:asset.id,label:`${ROLE_LABELS[asset.role]} · ${mediaByDbId.get(asset.mediaItemId)?.name ?? asset.media?.name ?? 'Missing media'}`}))]} />
        {activeDisplayAsset && (
          <div className="bk-compositor-grid">
            <SelectRow label="Placement" value={activePresentation.placement} onChange={value => void patchDisplayPresentation({placement:value as BrandAssetPresentation['placement']})} options={BRAND_ASSET_PLACEMENTS.map(value=>({value,label:value.replace('-',' ')}))} />
            <SelectRow label="Blend" value={activePresentation.blendMode} onChange={value=>void patchDisplayPresentation({blendMode:value as BrandAssetPresentation['blendMode']})} options={BRAND_ASSET_BLEND_MODES.map(value=>({value,label:value}))} />
            <SelectRow label="Visibility" value={activePresentation.visibility} onChange={value=>void patchDisplayPresentation({visibility:value as BrandAssetPresentation['visibility']})} options={BRAND_ASSET_VISIBILITY_MODES.map(value=>({value,label:value==='always'?'Always':value==='introOnly'?'Intro only':'Outro only'}))} />
            <SelectRow label="Glow" value={activePresentation.glowMode} onChange={value=>void patchDisplayPresentation({glowMode:value as BrandAssetPresentation['glowMode']})} options={BRAND_ASSET_GLOW_MODES.map(value=>({value,label:value==='audioReactive'?'Audio-reactive':value}))} />
            <SliderRow label="Scale" min={.04} max={.6} value={activePresentation.scale} onChange={scale=>void patchDisplayPresentation({scale})} />
            <SliderRow label="Opacity" value={activePresentation.opacity} onChange={opacity=>void patchDisplayPresentation({opacity})} />
            <SliderRow label="Safe-area inset" min={0} max={.2} value={activePresentation.margin} onChange={margin=>void patchDisplayPresentation({margin})} />
            <ToggleRow label="Preserve original artwork colors" value={activePresentation.preserveOriginalColors} onChange={preserveOriginalColors=>void patchDisplayPresentation({preserveOriginalColors})} />
            <IconChipButton type="button" onClick={() => void updateAsset(activeDisplayAsset.id, { presentation: { ...activePresentation, enabled: false } })}>Disable logo compositor</IconChipButton>
          </div>
        )}
        {displayAssets.length === 0 && <div className="bk-missing-slot">Link a logo, wordmark, monogram, watermark, or key art asset to enable canvas branding.</div>}
      </Collapsible>
      {BRAND_ASSET_ROLES.map(role => {
        const linked = assets.filter(asset => asset.role === role)
        return (
          <Collapsible key={role} label={ROLE_LABELS[role]}>
            <div className="bk-asset-role-heading">
              <div>
                <p className="bk-description">{ROLE_HINTS[role]}</p>
              </div>
              <IconChipButton
                type="button"
                onClick={() => setPickerRole(role)}
                disabled={syncing}
              >{linked.length ? (role === 'paletteSource' ? 'Add source' : 'Replace') : 'Choose media'}</IconChipButton>
            </div>
            {linked.length > 0
              ? <div className="bk-linked-assets">{linked.map(asset => (
                  <AssetPreview key={asset.id} asset={asset} media={mediaByDbId.get(asset.mediaItemId) ?? null} onRemove={() => void removeAsset(asset.id)} />
                ))}</div>
              : <span className="bk-description">No {ROLE_LABELS[role].toLowerCase()} selected.</span>}
          </Collapsible>
        )
      })}
      {pickerRole && (
        <AssetPicker
          role={pickerRole}
          onClose={() => setPickerRole(null)}
          onPick={item => void linkAsset(pickerRole, item)}
          onUpload={() => setUploadOpen(true)}
        />
      )}
      {uploadOpen && <MediaUploadModal onClose={() => setUploadOpen(false)} />}
    </div>
  )
}
