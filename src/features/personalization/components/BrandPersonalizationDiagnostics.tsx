import { useSyncExternalStore } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useBrandKitStore } from '../brandKitStore'
import { useReactStore } from '../../../stores/reactStore'
import { getBrandAssetCacheSnapshot, subscribeBrandAssetRuntime } from '../brandAssetRuntime'
import { resolveLaserDmxPersonalization } from '../laserDmxPersonalization'

function paletteFingerprint(values: readonly string[]): string {
  let hash = 2166136261
  for (const value of values.join('|')) {
    hash ^= value.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function BrandPersonalizationDiagnostics() {
  const { activeKit, activeAssets, currentUserId, activeMetadata, error } = useBrandKitStore(useShallow(state => ({
    activeKit: state.activeKit,
    activeAssets: state.activeAssets,
    currentUserId: state.currentUserId,
    activeMetadata: state.activeMetadata,
    error: state.error,
  })))
  const { activeEngineId, activePresetId } = useReactStore(useShallow(state => ({
    activeEngineId: state.activeReactEngineId,
    activePresetId: state.activeReactPresetId,
  })))
  const cache = useSyncExternalStore(subscribeBrandAssetRuntime, getBrandAssetCacheSnapshot, () => [])
  const userCache = cache.filter(entry => entry.userId === currentUserId)
  const overlay = activeAssets.find(asset => asset.presentation?.enabled) ?? null
  const overlayCache = overlay ? userCache.find(entry => entry.mediaItemId === overlay.mediaItemId) ?? null : null
  const laser = resolveLaserDmxPersonalization(activeKit, activePresetId)
  const presetRule = activeKit && activePresetId ? activeKit.presetRules[activePresetId] : undefined
  const engineRule = activeKit?.engineRules[activeEngineId]
  const engineSupported = true
  const effectiveMode = !activeKit || activeKit.autoApply === false || !engineSupported || presetRule?.enabled === false
    ? 'original'
    : (activeEngineId === 'laserDmx' ? laser?.mode ?? 'original' : presetRule?.mode ?? engineRule?.mode ?? 'hybrid')
  const effectiveStrength = effectiveMode === 'original'
    ? 0
    : Math.max(0, Math.min(1, presetRule?.strength ?? engineRule?.strength ?? activeKit?.defaultStrength ?? 0))

  return (
    <details className="bk-diagnostics">
      <summary>Personalization diagnostics</summary>
      <dl>
        <div><dt>Active kit</dt><dd>{activeKit ? `${activeKit.name} (${activeKit.id})` : 'None'}</dd></div>
        <div><dt>Palette fingerprint</dt><dd>{activeKit ? paletteFingerprint(Object.values(activeKit.palette)) : 'standard'}</dd></div>
        <div><dt>Current engine</dt><dd>{activeEngineId}</dd></div>
        <div><dt>Effective mode</dt><dd>{effectiveMode}</dd></div>
        <div><dt>Effective strength</dt><dd>{Math.round(effectiveStrength * 100)}%</dd></div>
        <div><dt>LaserDMX mode</dt><dd>{laser ? `${laser.mode} · ${Math.round(laser.strength * 100)}%` : 'Original'}</dd></div>
        <div><dt>Overlay asset</dt><dd>{overlay?.media?.name ?? (overlay ? overlay.mediaItemId : 'Disabled')}</dd></div>
        <div><dt>Asset load</dt><dd>{overlayCache?.status ?? 'idle'}{overlayCache?.source ? ` · ${overlayCache.source}` : ''}</dd></div>
        <div><dt>Cache</dt><dd>{userCache.length} account-scoped entr{userCache.length === 1 ? 'y' : 'ies'}</dd></div>
        <div><dt>Last sync</dt><dd>{activeMetadata.lastSyncedAt ?? 'Not synchronized'}</dd></div>
        <div><dt>Last error</dt><dd>{overlayCache?.lastError ?? error ?? 'None'}</dd></div>
      </dl>
    </details>
  )
}
