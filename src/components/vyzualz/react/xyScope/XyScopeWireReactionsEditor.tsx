import { AppIcon } from '../../../shared/icons/AppIcon'
import { IconChipButton } from '../controls/IconChipButton'
import { Collapsible, SelectRow, SliderRow, ToggleRow } from '../ReactControlRows'
import {
  DEFAULT_WIRE_RULES, MAX_WIRE_RULES, WIRE_EVERY_OPTIONS, WIRE_REACTION_OPTIONS, WIRE_TRIGGER_OPTIONS, type WireReaction, type WireRule, type WireTrigger,
} from './XyScopeWireReactions'

const label = (options: readonly { value: string; label: string }[], value: string) => options.find(option => option.value === value)?.label ?? value

/**
 * The editable list of reactions: "when this audio-intelligence trigger fires, do this reaction, this hard, every Nth time". Each rule is
 * a collapsible group (the standard `Collapsible`) with the standard rows: a select for the trigger and the reaction, a slider for how hard,
 * a select for how often and a toggle. The Canvas engine's trigger editor is a local preview inside its shell and is not reusable, so this is
 * built from the same shared control rows.
 */
export function XyScopeWireReactionsEditor({ rules, onChange }: { rules: readonly WireRule[]; onChange: (rules: WireRule[]) => void }) {
  const update = (id: string, patch: Partial<WireRule>) => onChange(rules.map(rule => rule.id === id ? { ...rule, ...patch } : rule))
  const add = () => {
    if (rules.length >= MAX_WIRE_RULES) return
    let n = rules.length + 1
    while (rules.some(rule => rule.id === `r-new-${n}`)) n++
    onChange([...rules, { id: `r-new-${n}`, enabled: true, trigger: 'kick', reaction: 'punch', amount: .6, every: 1 }])
  }
  return (
    <div data-wire-reactions="true" style={{ display: 'contents' }}>
      <div className="rv-ctrl-info">When a trigger from the music fires, its reaction plays. Audio Reactivity scales them all (zero turns them off). A live microphone has no beat grid, sections or chords, so the triggers that need them never fire there.</div>
      {rules.map(rule => (
        <Collapsible key={rule.id} label={`${rule.enabled ? '' : '(off) '}${label(WIRE_TRIGGER_OPTIONS, rule.trigger)} → ${label(WIRE_REACTION_OPTIONS, rule.reaction)}`}>
          <div data-wire-rule={rule.id} style={{ display: 'contents' }}>
            <SelectRow id={`xyscope-wire-rule-${rule.id}-trigger`} label="When" menuBoundarySelector=".vz-inspector" placement="below" value={rule.trigger}
              options={WIRE_TRIGGER_OPTIONS.map(option => ({ value: option.value, label: option.label }))} onChange={value => update(rule.id, { trigger: value as WireTrigger })}
              description="The audio-intelligence trigger that sets this reaction off." />
            <SelectRow id={`xyscope-wire-rule-${rule.id}-reaction`} label="Do" menuBoundarySelector=".vz-inspector" placement="below" value={rule.reaction}
              options={WIRE_REACTION_OPTIONS.map(option => ({ value: option.value, label: option.label }))} onChange={value => update(rule.id, { reaction: value as WireReaction })}
              description="What the figure does: a camera punch, a flash, a shockwave ring, a spin kick, a colour pulse, an echo burst, a star burst, a background pulse, or a shatter, morph, glitch or zoom-through." />
            <SliderRow id={`xyscope-wire-rule-${rule.id}-amount`} label="Amount" value={rule.amount} min={0} max={1.5} step={.01} resetValue={.6}
              formatValue={value => `${Math.round(value * 100)}%`} description="How hard the reaction hits." onChange={amount => update(rule.id, { amount })} />
            <SelectRow id={`xyscope-wire-rule-${rule.id}-every`} label="How Often" menuBoundarySelector=".vz-inspector" placement="below" value={String(rule.every)}
              options={WIRE_EVERY_OPTIONS.map(option => ({ value: String(option.value), label: option.label }))} onChange={value => update(rule.id, { every: Number(value) as WireRule['every'] })}
              description="Fire on every time the trigger happens, or only on every 2nd, 4th or 8th." />
            <ToggleRow id={`xyscope-wire-rule-${rule.id}-enabled`} label="Enabled" value={rule.enabled} onChange={enabled => update(rule.id, { enabled })} description="Turns this rule off without deleting it." />
            <IconChipButton onClick={() => onChange(rules.filter(other => other.id !== rule.id))} icon={<AppIcon kind="close" size={13} color="currentColor" />}>Remove Reaction</IconChipButton>
          </div>
        </Collapsible>
      ))}
      <div className="rv-ctrl-group" data-wire-reaction-actions="true">
        <IconChipButton onClick={add} icon={<AppIcon kind="plus" size={13} color="currentColor" />}>Add Reaction</IconChipButton>
        <IconChipButton onClick={() => onChange(DEFAULT_WIRE_RULES.map(rule => ({ ...rule })))}>Reset Reactions</IconChipButton>
      </div>
    </div>
  )
}
