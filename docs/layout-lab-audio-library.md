# Template audio-library studies

Layout Lab → Template shows three local-only mockups in the middle visualizer: User Audio, Uploaded Tracks, and Lyric Manager’s left window. They use the supplied dark customer-card reference: charcoal surfaces, small status labels, slim colored edge markers, compact single-column cards with artist/title text. Each study uses the shared Lyric Manager rail width (`--workspace-rail-width`, 354px default); track and version rows are 56px high, matching the production track row’s 40px artwork plus 8px top/bottom padding.

Each study has independent search, status filtering, track selection and detail disclosure. The lyric study includes two selectable lyric versions that follow the chosen track. “View all” clears the study’s filters. All tracks are fixtures; these controls do not access uploads, play audio or modify production stores.

The gallery scrolls within the middle visualizer. Existing Template left-window studies and the audio dock are preserved; the right window remains empty. Cinema 2.0 remains cleared.

Implementation: `src/components/vyzualz/react/layoutLab/TemplateAudioLibraryMockups.tsx` and its adjacent stylesheet. Coverage: `TemplateLayoutLabMockup.test.tsx`.

## Full Template style preview

When Template is selected, `.ll-template-audio-theme` applies the audio studies’ visual DNA across the Layout Lab shell: #111215 canvas, #1b1b21 panels, #26262e controls/cards, muted grey copy, cyan/peach detail markers, flatter borders and restrained selection states. Components, Inspector and Layout Lab headings replace the equipment-style emphasis with the reference’s quieter hierarchy. Left-window studies, right-window navigation and bottom-dock interactions remain intact. The right-window content stays empty.

The preview stylesheet is `templateAudioTheme.css`. Every selector is scoped beneath the Template-only class; switching engines removes it. Production workspaces, other engines and global appearance settings are unchanged.

The full-workspace comparison now opens by default. Select **Component reference**, then **Template**, to return to these original audio studies. See [Design workbench](layout-lab-design-workbench.md) for the production-component previews and design slots.
