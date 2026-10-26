import { AppIcon } from '../../../../shared/icons/AppIcon'
import { NotificationBellIcon } from '../../../shared/NotificationDrawer'
import { buildReactHeaderMetrics } from '../../ReactHeaderPerformanceStatus'
import { OaLed } from './oaControls'
import { OaRing } from './oaInstruments'

// ── Option A · header ──────────────────────────────────────────────────────────────────────────────────────────
//
// The same readings the production header carries (output status, Reveal, Blackout, Layout Lab, Loading, Saved, FPS,
// Frame Time, Quality, CPU, Notifications, profile), rebuilt as an instrument strip: the wordmark and design name on
// the left, the three output keys in the middle, and on the right the performance numbers drawn as ring gauges and LED
// ladders instead of labelled chips. Fixed readings, as in the other options; nothing here acts on anything.

const METRICS = buildReactHeaderMetrics({ fps: 60, frameTimeMs: 16.6, qualityTier: 'high' })
const QUALITY_STEPS = ['low', 'medium', 'high'] as const

export function OptionAHeader() {
  const qualityIndex = QUALITY_STEPS.indexOf(METRICS.quality.value as typeof QUALITY_STEPS[number])
  return (
    <header className="oa-header" aria-label="Layout Lab header group">
      <div className="oa-header__identity">
        <span className="oa-wordmark">DRMVYZ</span>
        <span className="oa-header__option">Option A</span>
      </div>

      <div className="oa-header__output" role="toolbar" aria-label="Global performance output">
        <button type="button" className="oa-output oa-output--status" disabled aria-label="OUTPUT PREVIEW" title="Production output controls become available when LaserDMX is active">
          <OaLed on={false} tone="red" />
          <AppIcon kind="power" size={16} />
          <span>Output preview</span>
        </button>
        <button type="button" className="oa-output" disabled aria-label="Reveal output" title="Reveal output">
          <AppIcon kind="eye" size={16} />
          <span>Reveal</span>
        </button>
        <button type="button" className="oa-output" disabled aria-label="Blackout output" title="Blackout output">
          <AppIcon kind="blackout" size={16} />
          <span>Blackout</span>
        </button>
      </div>

      <div className="oa-header__instruments">
        <button type="button" className="oa-iconkey" title="Layout Lab" aria-label="Layout Lab">
          <AppIcon kind="sliders" size={18} />
        </button>

        <div className="oa-readout" role="status" aria-label="Nothing loading" title="Nothing loading" data-busy="false">
          <AppIcon kind="loading" size={20} className="oa-readout__spinner" />
          <span className="oa-readout__label">Loading</span>
        </div>
        <div className="oa-readout" role="status" aria-label="Saved 11:31 AM" data-save-tone="saved">
          <span className="oa-readout__value"><OaLed on tone="ice" />11:31<small>AM</small></span>
          <span className="oa-readout__label">Saved</span>
        </div>

        <span className="oa-sep" aria-hidden="true" />

        <div className="oa-readout oa-readout--ring" title={METRICS.fps.title} aria-label={`FPS ${METRICS.fps.value}`}>
          <OaRing ratio={60 / 60} size={42} stroke={4} tone="ice"><b>{METRICS.fps.value}</b></OaRing>
          <span className="oa-readout__label">FPS</span>
        </div>
        <div className="oa-readout" title={METRICS.frameTime.title} aria-label={`Frame time ${METRICS.frameTime.value}`}>
          <span className="oa-readout__value">16.6<small>ms</small></span>
          <span className="oa-readout__label">Frame time</span>
        </div>
        <div className="oa-readout" title={METRICS.quality.title} aria-label={`Quality ${METRICS.quality.value}`}>
          <span className="oa-ladder" aria-hidden="true">
            {QUALITY_STEPS.map((step, index) => <OaLed key={step} on={index <= qualityIndex} tone="ice" />)}
          </span>
          <span className="oa-readout__label">Quality · {METRICS.quality.value}</span>
        </div>
        <div className="oa-readout oa-readout--ring" title="App CPU usage" aria-label="App CPU usage 0 percent">
          <OaRing ratio={0} size={42} stroke={4} tone="ember"><b>0<small>%</small></b></OaRing>
          <span className="oa-readout__label">CPU</span>
        </div>

        <span className="oa-sep" aria-hidden="true" />

        <button type="button" className="oa-iconkey" aria-label="Notifications" title="Notifications">
          <NotificationBellIcon />
        </button>
        <button type="button" className="oa-avatar" title="Profile">DV</button>
      </div>
    </header>
  )
}
