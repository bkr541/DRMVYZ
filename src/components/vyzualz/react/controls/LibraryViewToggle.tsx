import { HeaderActionIcon } from '../../layout/HeaderActionIcon'
import { HeaderIconKey } from '../../layout/HeaderIconKey'
import '../../layout/HeaderControlGroup.css'
import './LibraryViewToggle.css'

export type LibraryView = 'grid' | 'list'

/** One action icon: it shows the view that clicking will switch to. */
export function LibraryViewToggle({ view, onChange }: { view: LibraryView; onChange: (view: LibraryView) => void }) {
  const next = view === 'grid' ? 'list' : 'grid'
  return <div className="vz-header-group dv-library-view-toggle" data-library-view={view}>
    <HeaderIconKey label={next === 'list' ? 'List view' : 'Grid view'} icon={<HeaderActionIcon action={next} />} onClick={() => onChange(next)} />
  </div>
}
