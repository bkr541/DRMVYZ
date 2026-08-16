import { useEffect, useMemo, useState } from 'react'
import { useReactStore } from '../../../stores/reactStore'
import type { CanvasMediaItem } from './ReactTypes'
import { Collapsible } from './ReactControlRows'
import { IconChipButton } from './controls/IconChipButton'
import { DreamVizTextInput } from './controls/DreamVizTextInput'
import { NoticeCard } from './controls/NoticeCard'

interface CanvasMediaPoolsPanelProps {
  mediaItems: readonly CanvasMediaItem[]
}

function mediaLabel(item: CanvasMediaItem | undefined, mediaId: string): string {
  return item?.name ?? `Unavailable media · ${mediaId}`
}

export function CanvasMediaPoolsPanel({ mediaItems }: CanvasMediaPoolsPanelProps) {
  const mediaPools = useReactStore(s => s.canvasOrchestrationSettings.mediaPools)
  const activeMediaPoolId = useReactStore(s => s.canvasOrchestrationSettings.activeMediaPoolId)
  const createCanvasMediaPool = useReactStore(s => s.createCanvasMediaPool)
  const renameCanvasMediaPool = useReactStore(s => s.renameCanvasMediaPool)
  const deleteCanvasMediaPool = useReactStore(s => s.deleteCanvasMediaPool)
  const setActiveCanvasMediaPool = useReactStore(s => s.setActiveCanvasMediaPool)
  const removeCanvasMediaFromPool = useReactStore(s => s.removeCanvasMediaFromPool)
  const [inspectedPoolId, setInspectedPoolId] = useState<string | null>(null)
  const [createDraft, setCreateDraft] = useState('')
  const [renameDraft, setRenameDraft] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [confirmDeletePoolId, setConfirmDeletePoolId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const mediaById = useMemo(() => new Map(mediaItems.map(item => [item.id, item])), [mediaItems])
  const inspectedPool = mediaPools.find(pool => pool.id === inspectedPoolId) ?? null

  useEffect(() => {
    if (inspectedPoolId && mediaPools.some(pool => pool.id === inspectedPoolId)) return
    const nextPoolId = activeMediaPoolId && mediaPools.some(pool => pool.id === activeMediaPoolId)
      ? activeMediaPoolId
      : mediaPools[0]?.id ?? null
    setInspectedPoolId(nextPoolId)
    setRenaming(false)
    setConfirmDeletePoolId(null)
  }, [activeMediaPoolId, inspectedPoolId, mediaPools])

  const createPool = () => {
    const result = createCanvasMediaPool(createDraft)
    if (!result.ok) {
      setFeedback(result.message)
      return
    }
    setCreateDraft('')
    setFeedback(null)
    setInspectedPoolId(result.pool.id)
  }

  const renamePool = () => {
    if (!inspectedPool) return
    const result = renameCanvasMediaPool(inspectedPool.id, renameDraft)
    if (!result.ok) {
      setFeedback(result.message)
      return
    }
    setFeedback(null)
    setRenaming(false)
  }

  const deletePool = () => {
    if (!inspectedPool) return
    const result = deleteCanvasMediaPool(inspectedPool.id)
    if (!result.ok) {
      setFeedback(result.message)
      return
    }
    setFeedback(null)
    setConfirmDeletePoolId(null)
    setRenaming(false)
  }

  return (
    <Collapsible label="Media Pools" defaultOpen>
      <div className="rv-canvas-pools" aria-label="CANVAS Media Pools">
        <div className="rv-canvas-pools__summary">
          <span>{mediaPools.length} pool{mediaPools.length === 1 ? '' : 's'}</span>
          <em>{activeMediaPoolId ? '1 active' : 'None active'}</em>
        </div>

        <div className="rv-canvas-pools__create">
          <DreamVizTextInput
            value={createDraft}
            onChange={event => setCreateDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') createPool()
            }}
            placeholder="New pool name"
            aria-label="New CANVAS Media Pool name"
          />
          <IconChipButton onClick={createPool}>Create</IconChipButton>
        </div>

        {feedback && (
          <NoticeCard tone="warning" role="alert" title="CANVAS Media Pools" onDismiss={() => setFeedback(null)}>
            {feedback}
          </NoticeCard>
        )}

        {mediaPools.length === 0 ? (
          <p className="rv-control-helper-copy">Create a named Pool, make it active, then use Add to Pool from Media Library items.</p>
        ) : (
          <div className="rv-canvas-pools__list" role="list" aria-label="CANVAS Media Pool list">
            {mediaPools.map(pool => {
              const selected = pool.id === inspectedPoolId
              const active = pool.id === activeMediaPoolId
              return (
                <div key={pool.id} className={`rv-canvas-pools__row${selected ? ' rv-canvas-pools__row--selected' : ''}`} role="listitem">
                  <button
                    type="button"
                    className="rv-canvas-pools__select"
                    onClick={() => {
                      setInspectedPoolId(pool.id)
                      setRenaming(false)
                      setConfirmDeletePoolId(null)
                      setFeedback(null)
                    }}
                    aria-pressed={selected}
                  >
                    <strong>{pool.name}</strong>
                    <span>{pool.mediaIds.length} item{pool.mediaIds.length === 1 ? '' : 's'}</span>
                  </button>
                  <IconChipButton
                    tone={active ? 'primary' : 'default'}
                    aria-pressed={active}
                    aria-label={`${active ? 'Deactivate' : 'Activate'} CANVAS Media Pool ${pool.name}`}
                    onClick={() => {
                      setFeedback(null)
                      setActiveCanvasMediaPool(active ? null : pool.id)
                    }}
                  >
                    {active ? 'Active' : 'Set Active'}
                  </IconChipButton>
                </div>
              )
            })}
          </div>
        )}

        {inspectedPool && (
          <div className="rv-canvas-pools__inspector" aria-label={`Inspect CANVAS Media Pool ${inspectedPool.name}`}>
            <div className="rv-canvas-pools__inspector-head">
              <div>
                <span>Inspecting</span>
                <strong>{inspectedPool.name}</strong>
              </div>
              <div className="rv-canvas-pools__actions">
                <IconChipButton
                  onClick={() => {
                    setRenameDraft(inspectedPool.name)
                    setRenaming(true)
                    setConfirmDeletePoolId(null)
                    setFeedback(null)
                  }}
                >
                  Rename
                </IconChipButton>
                {confirmDeletePoolId === inspectedPool.id ? (
                  <>
                    <IconChipButton className="rv-glyph-upload-btn--danger" onClick={deletePool}>Confirm Delete</IconChipButton>
                    <IconChipButton onClick={() => setConfirmDeletePoolId(null)}>Cancel</IconChipButton>
                  </>
                ) : (
                  <IconChipButton
                    className="rv-glyph-upload-btn--danger"
                    onClick={() => {
                      setConfirmDeletePoolId(inspectedPool.id)
                      setRenaming(false)
                    }}
                  >
                    Delete
                  </IconChipButton>
                )}
              </div>
            </div>

            {renaming && (
              <div className="rv-canvas-pools__rename">
                <DreamVizTextInput
                  value={renameDraft}
                  onChange={event => setRenameDraft(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') renamePool()
                    if (event.key === 'Escape') setRenaming(false)
                  }}
                  aria-label={`Rename CANVAS Media Pool ${inspectedPool.name}`}
                />
                <IconChipButton onClick={renamePool}>Save</IconChipButton>
                <IconChipButton onClick={() => setRenaming(false)}>Cancel</IconChipButton>
              </div>
            )}

            {inspectedPool.mediaIds.length === 0 ? (
              <p className="rv-control-helper-copy">This Pool is empty. Add media from the Media Library while this Pool is active.</p>
            ) : (
              <div className="rv-canvas-pools__members" role="list" aria-label={`Media in ${inspectedPool.name}`}>
                {inspectedPool.mediaIds.map(mediaId => {
                  const item = mediaById.get(mediaId)
                  return (
                    <div key={mediaId} className="rv-canvas-pools__member" role="listitem">
                      <div className="rv-canvas-pools__member-copy">
                        {item?.thumbnailUrl || item?.objectUrl ? (
                          <img src={item.thumbnailUrl || item.objectUrl} alt="" />
                        ) : <span className="rv-canvas-pools__member-placeholder" aria-hidden="true" />}
                        <span title={mediaLabel(item, mediaId)}>{mediaLabel(item, mediaId)}</span>
                      </div>
                      <IconChipButton
                        aria-label={`Remove ${mediaLabel(item, mediaId)} from CANVAS Media Pool ${inspectedPool.name}`}
                        onClick={() => {
                          const result = removeCanvasMediaFromPool(inspectedPool.id, mediaId)
                          setFeedback(result.ok ? null : result.message)
                        }}
                      >
                        Remove
                      </IconChipButton>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Collapsible>
  )
}
