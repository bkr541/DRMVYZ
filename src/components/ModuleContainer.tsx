import { useRef, useState } from 'react'
import { ModuleInstance, ModuleWidth, ModuleHeight } from '../types'

interface Props {
  module: ModuleInstance
  primaryColor: string
  showBorders: boolean
  onWidthChange: (w: ModuleWidth) => void
  onHeightChange: (h: ModuleHeight) => void
  onToggle: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDragStart: (id: string) => void
  onDragOver: (id: string) => void
  onDrop: () => void
  editMode: boolean
  children: React.ReactNode
}

const WIDTHS: ModuleWidth[]  = ['sm', 'md', 'lg', 'xl']
const HEIGHTS: ModuleHeight[] = ['compact', 'normal', 'tall']
const W_LABELS: Record<ModuleWidth, string>  = { sm:'S', md:'M', lg:'L', xl:'XL' }
const H_LABELS: Record<ModuleHeight, string> = { compact:'C', normal:'N', tall:'T' }

export function ModuleContainer({
  module, showBorders,
  onWidthChange, onHeightChange, onToggle, onMoveUp, onMoveDown,
  onDragStart, onDragOver, onDrop,
  editMode, children,
}: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      className={`module-container module-w-${module.width} module-h-${module.height} ${dragOver ? 'drag-over' : ''}`}
      draggable={editMode}
      onDragStart={() => onDragStart(module.id)}
      onDragOver={e => { e.preventDefault(); setDragOver(true); onDragOver(module.id) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={() => { setDragOver(false); onDrop() }}
    >
      {/* Panel header */}
      <div className="module-header">
        {editMode && <span className="drag-handle" title="Drag to reorder">⠿</span>}
        <span className="module-label">{module.label}</span>

        <div className="module-header-right">
          {/* Mode badge — show current settings hint */}
          {module.settings.spectrumMode && (
            <span className="panel-mode-badge">{module.settings.spectrumMode}</span>
          )}
          {module.settings.levelMode && (
            <span className="panel-mode-badge">{module.settings.levelMode}</span>
          )}
          {module.settings.oscMode && (
            <span className="panel-mode-badge">{module.settings.oscMode}</span>
          )}
          {module.settings.waveformMode && (
            <span className="panel-mode-badge">{module.settings.waveformMode}</span>
          )}

          {/* Edit mode controls */}
          {editMode && (
            <div className="module-controls">
              <div style={{ display:'flex', gap:2 }}>
                {WIDTHS.map(w => (
                  <button key={w} className={`sz-btn ${module.width===w?'active':''}`}
                    onClick={() => onWidthChange(w)} title={`Width ${w}`}>
                    W:{W_LABELS[w]}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', gap:2 }}>
                {HEIGHTS.map(h => (
                  <button key={h} className={`sz-btn ${module.height===h?'active':''}`}
                    onClick={() => onHeightChange(h)} title={`Height ${h}`}>
                    H:{H_LABELS[h]}
                  </button>
                ))}
              </div>
              <button className="sz-btn" onClick={onMoveUp}>↑</button>
              <button className="sz-btn" onClick={onMoveDown}>↓</button>
              <button className="sz-btn" onClick={onToggle} title="Disable">✕</button>
            </div>
          )}

          {/* ··· menu — always visible */}
          {!editMode && (
            <button
              className="panel-menu-btn"
              onClick={() => setMenuOpen(p => !p)}
              title="Module options"
            >
              ···
            </button>
          )}
        </div>
      </div>

      {/* Simple context menu */}
      {menuOpen && !editMode && (
        <div
          style={{
            position:'absolute', top:34, right:8, zIndex:50,
            background:'#131920', border:'1px solid rgba(255,255,255,0.1)',
            borderRadius:6, padding:'4px 0', minWidth:130,
            boxShadow:'0 4px 16px rgba(0,0,0,0.5)',
          }}
          onMouseLeave={() => setMenuOpen(false)}
        >
          <CtxItem onClick={() => { onToggle(); setMenuOpen(false) }}>Disable</CtxItem>
          <CtxItem onClick={() => { onMoveUp(); setMenuOpen(false) }}>Move Up</CtxItem>
          <CtxItem onClick={() => { onMoveDown(); setMenuOpen(false) }}>Move Down</CtxItem>
        </div>
      )}

      <div className="module-body">{children}</div>
    </div>
  )
}

function CtxItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      style={{
        display:'block', width:'100%', padding:'6px 12px',
        background:'none', border:'none', textAlign:'left',
        fontSize:11, color:'rgba(224,234,248,0.65)', cursor:'pointer',
        transition:'all 0.12s',
      }}
      onClick={onClick}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {children}
    </button>
  )
}
