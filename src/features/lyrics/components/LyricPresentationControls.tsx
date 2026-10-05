import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
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
import { Collapsible, ColorRow, NumberInputRow, SelectRow, SliderRow } from '../../../components/vyzualz/react/ReactControlRows'

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
  /** Appearance fields rendered elsewhere (the Cue inspector shows Position and Text size in its main grid). */
  omit?: Array<'anchor' | 'fontSize'>
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

interface StyleFieldProps {
  style: Partial<LyricStyle>
  allowInherit?: boolean
  onStyleChange: (patch: Partial<LyricStyle>) => void
  label?: string
}

/** Screen position preset (top / center / lower third / bottom, or a custom x/y). */
export function LyricAnchorField({ style, onStyleChange, label = 'Screen anchor' }: StyleFieldProps) {
  return (
    <SelectRow
      label={label}
      value={anchorPresetFor(style)}
      onChange={value => {
        const patch = anchorPresetPatch(value as LyricAnchorPreset)
        if (patch) onStyleChange(patch)
      }}
      options={[
        { value: 'custom', label: 'Custom position' },
        { value: 'top', label: 'Top center' },
        { value: 'center', label: 'Center' },
        { value: 'lower-third', label: 'Lower third' },
        { value: 'bottom', label: 'Bottom center' },
      ]}
    />
  )
}

/** Font size in the 8–300 range; empty means "inherit" when overriding. */
export function LyricFontSizeField({ style, allowInherit = false, onStyleChange, label = 'Font size' }: StyleFieldProps) {
  return (
    <NumberInputRow
      label={label}
      min={8}
      max={300}
      step={1}
      value={style.fontSize ?? ''}
      placeholder={allowInherit ? 'Inherit' : '72'}
      onChange={value => onStyleChange({ fontSize: clampPresentationNumber(value, 8, 300) })}
      onEmpty={() => onStyleChange({ fontSize: undefined })}
    />
  )
}

/**
 * Appearance, Animation and Effects as three standard control groups (Collapsible + shared control rows). With `allowInherit`
 * (a cue) they are the cue's "… Overrides" and each offers a reset to the document default; without it (the Document tab) they
 * are the document's "Default …" groups.
 */
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
  omit,
}: Props) {
  const animationPreset = animationPresetFor(animation, allowInherit)
  const effectPreset = effectPresetFor(effects, allowInherit)
  const title = (name: string) => (allowInherit ? `${name} Overrides` : `Default ${name}`)
  const resetAction = (active: boolean, onClear: (() => void) | undefined, label: string) => (
    allowInherit && active && onClear
      ? <div className="rv-ctrl-action-row"><IconChipButton onClick={onClear}>{label}</IconChipButton></div>
      : null
  )

  return (
    <>
      <Collapsible label={title('Appearance')}>
        {resetAction(Object.keys(style).length > 0, onClearStyle, 'Use document defaults')}
        <div className="lmv-inspector-grid">
          <ColorRow
            label="Text color"
            value={typeof style.color === 'string' ? style.color : ''}
            placeholder={allowInherit ? 'Inherit' : '#FFFFFF'}
            onChange={color => onStyleChange({ color })}
          />
          {!omit?.includes('fontSize') && <LyricFontSizeField style={style} allowInherit={allowInherit} onStyleChange={onStyleChange} />}
          <SelectRow
            label="Weight"
            value={style.fontWeight === undefined ? (allowInherit ? '' : '400') : String(style.fontWeight)}
            onChange={value => onStyleChange({ fontWeight: value ? Number(value) : undefined })}
            options={[
              ...(allowInherit ? [{ value: '', label: 'Inherit' }] : []),
              { value: '400', label: 'Regular' },
              { value: '500', label: 'Medium' },
              { value: '600', label: 'Semibold' },
              { value: '700', label: 'Bold' },
              { value: '800', label: 'Extra bold' },
              { value: '900', label: 'Black' },
            ]}
          />
          <SelectRow
            label="Alignment"
            value={style.align ?? (allowInherit ? '' : 'left')}
            onChange={value => onStyleChange({ align: value ? value as LyricStyle['align'] : undefined })}
            options={[
              ...(allowInherit ? [{ value: '', label: 'Inherit' }] : []),
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' },
            ]}
          />
          {!omit?.includes('anchor') && <LyricAnchorField style={style} allowInherit={allowInherit} onStyleChange={onStyleChange} />}
          <SliderRow
            label="Opacity"
            min={0}
            max={1}
            step={0.05}
            value={style.opacity ?? 1}
            onChange={value => onStyleChange({ opacity: clampPresentationNumber(value, 0, 1) })}
          />
          <NumberInputRow
            label="X position"
            min={0}
            max={1}
            step={0.01}
            value={style.x ?? ''}
            placeholder={allowInherit ? 'Inherit' : '0.5'}
            onChange={value => onStyleChange({ x: clampPresentationNumber(value, 0, 1) })}
            onEmpty={() => onStyleChange({ x: undefined })}
          />
          <NumberInputRow
            label="Y position"
            min={0}
            max={1}
            step={0.01}
            value={style.y ?? ''}
            placeholder={allowInherit ? 'Inherit' : '0.78'}
            onChange={value => onStyleChange({ y: clampPresentationNumber(value, 0, 1) })}
            onEmpty={() => onStyleChange({ y: undefined })}
          />
        </div>
      </Collapsible>

      <Collapsible label={title('Animation')}>
        {resetAction(Object.keys(animation).length > 0, onClearAnimation, 'Use document default')}
        <SelectRow
          label="Animation preset"
          value={animationPreset}
          onChange={value => {
            const preset = value as LyricAnimationPreset
            const patch = animationPresetPatch(preset)
            if (patch) onAnimationChange(patch)
            else onClearAnimation?.()
          }}
          options={[
            ...(allowInherit ? [{ value: 'inherit', label: 'Inherit' }] : []),
            { value: 'none', label: 'None' },
            { value: 'fade', label: 'Fade' },
            { value: 'fade-up', label: 'Fade up' },
            { value: 'pop', label: 'Scale pop' },
            { value: 'typewriter', label: 'Typewriter' },
            { value: 'glitch', label: 'Glitch' },
          ]}
        />
      </Collapsible>

      <Collapsible label={title('Effects')}>
        {resetAction(Object.keys(effects).length > 0, onClearEffects, 'Use document default')}
        <SelectRow
          label="Effect preset"
          value={effectPreset}
          onChange={value => {
            const preset = value as LyricEffectPreset
            const patch = effectPresetPatch(preset)
            if (patch) onEffectsChange(patch)
            else onClearEffects?.()
          }}
          options={[
            ...(allowInherit ? [{ value: 'inherit', label: 'Inherit' }] : []),
            { value: 'none', label: 'None' },
            { value: 'soft-glow', label: 'Soft glow' },
            { value: 'beat-punch', label: 'Beat punch' },
            { value: 'glitch', label: 'Glitch' },
            { value: 'bass-reactive', label: 'Bass reactive' },
          ]}
        />
      </Collapsible>
    </>
  )
}
