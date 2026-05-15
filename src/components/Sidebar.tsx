import React from 'react'
import type { VisualPreset } from '../types'
import type { MonitoringMode } from '../types/audio'
import { MONITORING_MODE_LABELS } from '../types/audio'
import { THEME_COLORS } from '../types'

export type NavItem = 'home' | 'metering' | 'analyzer' | 'reference' | 'mastering' | 'settings'

const NAV_ITEMS: Array<{ id: NavItem; icon: string; label: string }> = [
  { id: 'home',      icon: '⊞',  label: 'Home' },
  { id: 'metering',  icon: '▊',  label: 'Metering' },
  { id: 'analyzer',  icon: '◌',  label: 'Analyzer' },
  { id: 'reference', icon: '⇄',  label: 'Reference' },
  { id: 'mastering', icon: '◎',  label: 'Mastering' },
  { id: 'settings',  icon: '⚙',  label: 'Settings' },
]

interface Props {
  activeNav: NavItem
  onNav: (n: NavItem) => void
  presets: VisualPreset[]
  activePresetId: string | null
  onPresetLoad: (id: string) => void
  onNewPreset: () => void
  monitoringMode: MonitoringMode
  volume: number
  onVolume: (v: number) => void
  primaryColor: string
  secondaryColor: string
  theme: string
}

export function Sidebar({
  activeNav, onNav, presets, activePresetId, onPresetLoad, onNewPreset,
  monitoringMode, volume, onVolume, primaryColor, secondaryColor, theme,
}: Props) {
  const monLabel = MONITORING_MODE_LABELS[monitoringMode]
  const volPct = `${Math.round(volume * 100)}%`

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-wordmark">
          <span style={{ color: primaryColor }}>DRM</span>
          <span style={{ color: secondaryColor }}>VYZ</span>
        </div>
        <div className="sidebar-logo-sub">Signal Analysis</div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${activeNav === item.id ? 'active' : ''}`}
            onClick={() => onNav(item.id)}
          >
            <i className="sidebar-nav-icon">{item.icon}</i>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Presets */}
      <div className="sidebar-section-label">
        Presets
        <button className="sidebar-section-add" onClick={onNewPreset} title="Save preset">+</button>
      </div>

      <div className="sidebar-presets">
        {/* Built-in presets */}
        <div
          className={`sidebar-preset-item ${activePresetId === null ? 'active' : ''}`}
          onClick={() => onPresetLoad('__default')}
        >
          <span className="sidebar-preset-name">Default</span>
          <span className="sidebar-preset-badge">FLAT</span>
        </div>

        {/* User presets */}
        {presets.map(p => (
          <div
            key={p.id}
            className={`sidebar-preset-item ${activePresetId === p.id ? 'active' : ''}`}
            onClick={() => onPresetLoad(p.id)}
          >
            <span className="sidebar-preset-name">{p.name}</span>
          </div>
        ))}
      </div>

      {/* Output / monitoring */}
      <div className="sidebar-output">
        <div className="sidebar-output-label">Output</div>
        <div className="sidebar-output-device">
          <span className="sidebar-output-device-name">
            {monLabel !== 'Stereo' ? `◈ ${monLabel}` : '◉ Stereo Output'}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9 }}>▾</span>
        </div>
        <div className="sidebar-volume-row">
          <svg className="sidebar-vol-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
          <input
            type="range" className="vol-slider"
            min={0} max={1} step={0.01} value={volume}
            onChange={e => onVolume(parseFloat(e.target.value))}
            style={{ '--pct': `${volume * 100}%` } as React.CSSProperties}
          />
          <span className="sidebar-vol-val">{Math.round(volume * 100)}%</span>
        </div>
      </div>
    </aside>
  )
}
