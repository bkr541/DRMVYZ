# Media Manager library groups

The Media Library's All Visuals and Favorites views have separate Images and
Videos groups, each with its own search field and the shared grid/list control.
Opened collections use the same two groups. The Images and Videos filter tabs
show only the matching group. 3D Models keeps its independent search. Group
headers contain their title and icon, with no item count or Newest First copy.

Image/video searches match titles, filenames, descriptions and tags independently.
They filter canonical media metadata without changing the other group's search.
The existing store continues to load newest-first pages; active group searches
continue through remaining metadata pages so results are not limited to the first
page. A missing media type also advances paging to avoid a false empty group.
This preserves the existing signing, refresh, error/retry and card-action paths.
Multi-selection order follows images then videos, matching the rendered groups.

The change is scoped to Media Manager. Other media-browser contexts retain their
existing search and grouping behavior.

Validation: 41 focused media-browser/model-card tests passed, covering independent
searches, paging, card actions, selection, collections, loading states and model
paging. Two pre-existing audio-loader assertions were excluded after failing on
the unrelated `notifyOnBlocked` argument. TypeScript, focused ESLint and diff
checks passed. The running native app showed separate Images/Videos search
fields and clean group headings. No production build was run for this change.
