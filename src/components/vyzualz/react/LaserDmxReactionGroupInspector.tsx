import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { SliderRow, ToggleRow, TextInputRow, CtrlSection, Collapsible } from './ReactControlRows'
import { LaserDmxGroupSequencerControls } from './LaserDmxGroupSequencerControls'
import { LaserDmxTimingStatus } from './LaserDmxTimingStatus'
import { LaserDmxLaunchControls } from './LaserDmxLaunchControls'

function groupColorCss(r: number, g: number, b: number, a: number) {
  return `rgba(${r},${g},${b},${a})`
}

export function LaserDmxReactionGroupInspector() {
  const {
    laserDmxBeamMatrix,
    updateLaserDmxReactionGroup,
    removeLaserDmxReactionGroup,
    duplicateLaserDmxReactionGroup,
    selectLaserDmxReactionGroup,
    setLaserDmxReactionGroupMuted,
    setLaserDmxReactionGroupSoloed,
    restoreStarterReactionGroups,
  } = useReactStore(useShallow(s => ({
    laserDmxBeamMatrix:                 s.laserDmxBeamMatrix,
    updateLaserDmxReactionGroup:        s.updateLaserDmxReactionGroup,
    removeLaserDmxReactionGroup:        s.removeLaserDmxReactionGroup,
    duplicateLaserDmxReactionGroup:     s.duplicateLaserDmxReactionGroup,
    selectLaserDmxReactionGroup:        s.selectLaserDmxReactionGroup,
    setLaserDmxReactionGroupMuted:      s.setLaserDmxReactionGroupMuted,
    setLaserDmxReactionGroupSoloed:     s.setLaserDmxReactionGroupSoloed,
    restoreStarterReactionGroups:       s.restoreStarterReactionGroups,
  })))

  const { groups, beams, selectedGroupId } = laserDmxBeamMatrix
  const group = groups.find(g => g.id === selectedGroupId) ?? null
  const assignedCount = group ? beams.filter(b => b.groupId === group.id).length : 0

  return (
    <>
      <CtrlSection label="Reaction Groups" />

      {/* Group list */}
      <div className="rv-bm-group-list">
        {groups.map(g => {
          const count = beams.filter(b => b.groupId === g.id).length
          const colorDot = g.colorOverrideEnabled
            ? groupColorCss(g.color.red, g.color.green, g.color.blue, g.color.alpha)
            : 'rgba(232,244,248,0.3)'
          return (
            <div
              key={g.id}
              className={`rv-bm-group-row${g.id === selectedGroupId ? ' rv-bm-group-row--active' : ''}${g.muted ? ' rv-bm-group-row--muted' : ''}`}
              onClick={() => selectLaserDmxReactionGroup(g.id === selectedGroupId ? null : g.id)}
              role="button"
              tabIndex={0}
              aria-label={`Select group ${g.name}`}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') selectLaserDmxReactionGroup(g.id === selectedGroupId ? null : g.id) }}
            >
              <span
                className="rv-bm-group-dot"
                style={{ background: colorDot }}
                aria-hidden="true"
              />
              <span className="rv-bm-group-name">{g.name}</span>
              <span className="rv-bm-group-count">{count}</span>
              <button
                type="button"
                className={`rv-bm-group-btn${g.muted ? ' rv-bm-group-btn--active' : ''}`}
                title={g.muted ? 'Unmute' : 'Mute'}
                aria-label={`${g.muted ? 'Unmute' : 'Mute'} group ${g.name}`}
                onClick={e => { e.stopPropagation(); setLaserDmxReactionGroupMuted(g.id, !g.muted) }}
              >M</button>
              <button
                type="button"
                className={`rv-bm-group-btn${g.soloed ? ' rv-bm-group-btn--active' : ''}`}
                title={g.soloed ? 'Unsolo' : 'Solo'}
                aria-label={`${g.soloed ? 'Unsolo' : 'Solo'} group ${g.name}`}
                onClick={e => { e.stopPropagation(); setLaserDmxReactionGroupSoloed(g.id, !g.soloed) }}
              >S</button>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
        <button
          type="button"
          className="rv-glyph-upload-btn"
          aria-label="Add reaction group"
          onClick={() => useReactStore.getState().addLaserDmxReactionGroup()}
        >
          + Group
        </button>
        {group && (
          <>
            <button
              type="button"
              className="rv-glyph-upload-btn"
              aria-label={`Duplicate group ${group.name}`}
              onClick={() => duplicateLaserDmxReactionGroup(group.id)}
            >
              ⧉ Dupe
            </button>
            <button
              type="button"
              className="rv-glyph-upload-btn rv-glyph-upload-btn--danger"
              aria-label={`Delete group ${group.name}`}
              onClick={() => { if (window.confirm(`Delete group "${group.name}"?`)) removeLaserDmxReactionGroup(group.id) }}
            >
              × Delete
            </button>
          </>
        )}
        <button
          type="button"
          className="rv-glyph-upload-btn"
          title="Restore the four default starter groups (Bass React, Snare React, Beat React, Custom React)"
          onClick={restoreStarterReactionGroups}
        >
          Restore Starters
        </button>
      </div>

      {/* Selected group editor */}
      {group && (
        <>
          <CtrlSection label={`Edit: ${group.name}`} />
          <TextInputRow
            label="Name"
            value={group.name}
            onChange={v => updateLaserDmxReactionGroup(group.id, { name: v })}
            maxLength={32}
            placeholder="Group name"
          />
          <ToggleRow label="Enabled" value={group.enabled} onChange={v => updateLaserDmxReactionGroup(group.id, { enabled: v })} />
          <ToggleRow label="Muted"   value={group.muted}   onChange={v => setLaserDmxReactionGroupMuted(group.id, v)} />
          <ToggleRow label="Solo"    value={group.soloed}  onChange={v => setLaserDmxReactionGroupSoloed(group.id, v)} />

          <ToggleRow
            label="Color Override"
            value={group.colorOverrideEnabled}
            onChange={v => updateLaserDmxReactionGroup(group.id, { colorOverrideEnabled: v })}
          />
          {group.colorOverrideEnabled && (
            <>
              <SliderRow label="Red"   value={group.color.red}   onChange={v => updateLaserDmxReactionGroup(group.id, { color: { ...group.color, red:   Math.round(v) } })} min={0} max={255} step={1} color="#c0314a" />
              <SliderRow label="Green" value={group.color.green} onChange={v => updateLaserDmxReactionGroup(group.id, { color: { ...group.color, green: Math.round(v) } })} min={0} max={255} step={1} color="#61d6aa" />
              <SliderRow label="Blue"  value={group.color.blue}  onChange={v => updateLaserDmxReactionGroup(group.id, { color: { ...group.color, blue:  Math.round(v) } })} min={0} max={255} step={1} color="#4ac7db" />
              <SliderRow label="White" value={group.color.white} onChange={v => updateLaserDmxReactionGroup(group.id, { color: { ...group.color, white: Math.round(v) } })} min={0} max={255} step={1} color="#e8f4f8" />
              <SliderRow label="Alpha" value={group.color.alpha} onChange={v => updateLaserDmxReactionGroup(group.id, { color: { ...group.color, alpha: v } })} min={0} max={1} step={0.01} color="#b84fc9" />
            </>
          )}

          <div className="rv-ctrl-info">
            {assignedCount} beam{assignedCount !== 1 ? 's' : ''} assigned
          </div>

          <Collapsible label="Audio Launch" defaultOpen={group.launch.trigger !== 'none'}>
            <LaserDmxLaunchControls
              launch={group.launch}
              onChange={patch => updateLaserDmxReactionGroup(group.id, { launch: { ...group.launch, ...patch } })}
              maxActiveBeams={group.maxActiveBeams}
              onMaxActiveChange={v => updateLaserDmxReactionGroup(group.id, { maxActiveBeams: v })}
            />
          </Collapsible>

          <Collapsible label="Sequencer" defaultOpen={group.sequence.enabled}>
            <LaserDmxGroupSequencerControls
              sequence={group.sequence}
              onChange={seq => updateLaserDmxReactionGroup(group.id, { sequence: seq })}
            />
            <LaserDmxTimingStatus sequencingActive={group.sequence.enabled} />
          </Collapsible>
        </>
      )}
    </>
  )
}
