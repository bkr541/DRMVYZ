import type { LyricAnimation, LyricEffects, LyricStyle } from '../../../types/lyrics'
import {
  anchorPresetPatch,
  animationPresetPatch,
  clampPresentationNumber,
  effectPresetPatch,
  type LyricAnchorPreset,
  type LyricAnimationPreset,
  type LyricEffectPreset,
} from '../utils/lyricPresentation'

interface Props {
  style: Partial<LyricStyle>
  animation: Partial<LyricAnimation>
  effects: Partial<LyricEffects>
  allowInherit?: boolean
  onStyleChange: (patch: Partial<LyricStyle>) => void
  onAnimationChange: (patch: Partial<LyricAnimation>) => void
  onEffectsChange: (patch: Partial<LyricEffects>) => void
  onClearStyle?: () => void
  onClearAnimation?: () => void
  onClearEffects?: () => void
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function animationPresetFor(value: Partial<LyricAnimation>, allowInherit: boolean): LyricAnimationPreset {
  if (allowInherit && Object.keys(value).length === 0) return 'inherit'
  if (value.in === 'fadeUp') return 'fade-up'
  if (value.in === 'scalePop') return 'pop'
  if (value.in === 'typewriter') return 'typewriter'
  if (value.in === 'glitch') return 'glitch'
  if (value.in === 'fade') return 'fade'
  return 'none'
}

function effectPresetFor(value: Partial<LyricEffects>, allowInherit: boolean): LyricEffectPreset {
  if (allowInherit && Object.keys(value).length === 0) return 'inherit'
  if ((value.glitch ?? 0) >= 0.4 || (value.rgbSplit ?? 0) >= 0.35) return 'glitch'
  if ((value.bassScale ?? 0) >= 0.35) return 'bass-reactive'
  if ((value.beatPunch ?? 0) >= 0.5) return 'beat-punch'
  if ((value.glow ?? 0) >= 0.3 || (value.bloom ?? 0) >= 0.2) return 'soft-glow'
  return 'none'
}

function anchorPresetFor(value: Partial<LyricStyle>): LyricAnchorPreset {
  const x = value.x
  const y = value.y
  const align = value.align
  if (x === 0.5 && y === 0.15 && align === 'center') return 'top'
  if (x === 0.5 && y === 0.5 && align === 'center') return 'center'
  if (x === 0.5 && y === 0.78 && align === 'center') return 'lower-third'
  if (x === 0.5 && y === 0.9 && align === 'center') return 'bottom'
  return 'custom'
}

export function LyricPresentationControls({
  style,
  animation,
  effects,
  allowInherit = false,
  onStyleChange,
  onAnimationChange,
  onEffectsChange,
  onClearStyle,
  onClearAnimation,
  onClearEffects,
}: Props) {
  const animationPreset = animationPresetFor(animation, allowInherit)
  const effectPreset = effectPresetFor(effects, allowInherit)
  const anchorPreset = anchorPresetFor(style)

  return (
    <div className="lmv-presentation-controls">
      <div className="lmv-presentation-section">
        <div className="lmv-presentation-heading">
          <strong>Appearance</strong>
          {allowInherit && Object.keys(style).length > 0 && onClearStyle && (
            <button type="button" className="lmv-inline-action" onClick={onClearStyle}>Use document defaults</button>
          )}
        </div>
        <div className="lmv-presentation-grid">
          <label>
            <span>Text color</span>
            <span className="lmv-color-control">
              <input
                type="color"
                value={typeof style.color === 'string' && /^#[0-9a-f]{6}$/i.test(style.color) ? style.color : '#ffffff'}
                onChange={event => onStyleChange({ color: event.target.value })}
                aria-label="Lyric text color"
              />
              <input
                className="lmv-input"
                value={style.color ?? ''}
                placeholder={allowInherit ? 'Inherit' : '#ffffff'}
                onChange={event => onStyleChange({ color: event.target.value || undefined })}
              />
            </span>
          </label>
          <label>
            <span>Font size</span>
            <input
              className="lmv-num"
              type="number"
              min={8}
              max={300}
              step={1}
              value={style.fontSize ?? ''}
              placeholder={allowInherit ? 'Inherit' : '72'}
              onChange={event => {
                const value = optionalNumber(event.target.value)
                onStyleChange({ fontSize: value === undefined ? undefined : clampPresentationNumber(value, 8, 300) })
              }}
            />
          </label>
          <label>
            <span>Weight</span>
            <select className="lmv-select" value={style.fontWeight ?? ''} onChange={event => onStyleChange({ fontWeight: event.target.value ? Number(event.target.value) : undefined })}>
              {allowInherit && <option value="">Inherit</option>}
              <option value="400">Regular</option>
              <option value="500">Medium</option>
              <option value="600">Semibold</option>
              <option value="700">Bold</option>
              <option value="800">Extra bold</option>
              <option value="900">Black</option>
            </select>
          </label>
          <label>
            <span>Alignment</span>
            <select className="lmv-select" value={style.align ?? ''} onChange={event => onStyleChange({ align: event.target.value ? event.target.value as LyricStyle['align'] : undefined })}>
              {allowInherit && <option value="">Inherit</option>}
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label>
            <span>Screen anchor</span>
            <select
              className="lmv-select"
              value={anchorPreset}
              onChange={event => {
                const patch = anchorPresetPatch(event.target.value as LyricAnchorPreset)
                if (patch) onStyleChange(patch)
              }}
            >
              <option value="custom">Custom position</option>
              <option value="top">Top center</option>
              <option value="center">Center</option>
              <option value="lower-third">Lower third</option>
              <option value="bottom">Bottom center</option>
            </select>
          </label>
          <label>
            <span>Opacity</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={style.opacity ?? 1}
              onChange={event => onStyleChange({ opacity: clampPresentationNumber(Number(event.target.value), 0, 1) })}
              aria-label="Lyric opacity"
            />
            <output>{Math.round((style.opacity ?? 1) * 100)}%</output>
          </label>
          <label>
            <span>X position</span>
            <input className="lmv-num" type="number" min={0} max={1} step={0.01} value={style.x ?? ''} placeholder={allowInherit ? 'Inherit' : '0.5'} onChange={event => {
              const value = optionalNumber(event.target.value)
              onStyleChange({ x: value === undefined ? undefined : clampPresentationNumber(value, 0, 1) })
            }} />
          </label>
          <label>
            <span>Y position</span>
            <input className="lmv-num" type="number" min={0} max={1} step={0.01} value={style.y ?? ''} placeholder={allowInherit ? 'Inherit' : '0.78'} onChange={event => {
              const value = optionalNumber(event.target.value)
              onStyleChange({ y: value === undefined ? undefined : clampPresentationNumber(value, 0, 1) })
            }} />
          </label>
        </div>
      </div>

      <div className="lmv-presentation-section">
        <div className="lmv-presentation-heading">
          <strong>Animation</strong>
          {allowInherit && Object.keys(animation).length > 0 && onClearAnimation && (
            <button type="button" className="lmv-inline-action" onClick={onClearAnimation}>Use document default</button>
          )}
        </div>
        <label>
          <span>Animation preset</span>
          <select
            className="lmv-select"
            value={animationPreset}
            onChange={event => {
              const preset = event.target.value as LyricAnimationPreset
              const patch = animationPresetPatch(preset)
              if (patch) onAnimationChange(patch)
              else onClearAnimation?.()
            }}
          >
            {allowInherit && <option value="inherit">Inherit</option>}
            <option value="none">None</option>
            <option value="fade">Fade</option>
            <option value="fade-up">Fade up</option>
            <option value="pop">Scale pop</option>
            <option value="typewriter">Typewriter</option>
            <option value="glitch">Glitch</option>
          </select>
        </label>
      </div>

      <div className="lmv-presentation-section">
        <div className="lmv-presentation-heading">
          <strong>Effects</strong>
          {allowInherit && Object.keys(effects).length > 0 && onClearEffects && (
            <button type="button" className="lmv-inline-action" onClick={onClearEffects}>Use document default</button>
          )}
        </div>
        <label>
          <span>Effect preset</span>
          <select
            className="lmv-select"
            value={effectPreset}
            onChange={event => {
              const preset = event.target.value as LyricEffectPreset
              const patch = effectPresetPatch(preset)
              if (patch) onEffectsChange(patch)
              else onClearEffects?.()
            }}
          >
            {allowInherit && <option value="inherit">Inherit</option>}
            <option value="none">None</option>
            <option value="soft-glow">Soft glow</option>
            <option value="beat-punch">Beat punch</option>
            <option value="glitch">Glitch</option>
            <option value="bass-reactive">Bass reactive</option>
          </select>
        </label>
      </div>
    </div>
  )
}
