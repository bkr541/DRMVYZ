# React engine selector identity

All six engines use Cinema 2.0's card styling in both the selected engine and dropdown options. Engine and title text are left-aligned at a 12px internal inset, with the same bold uppercase display typography. Preset names share the right-aligned lower row; cards without a preset reserve that line to keep text positions identical.

The active preset name uses 16px display type. Three decorative copies recede upward and left into the artwork, with progressively lower opacity and greater blur under a fading mask. The foreground name remains crisp and truncates independently. Echoes use the same primary color, ignore pointer events, and are hidden from assistive technology; cards without preset names do not render them.

Each engine keeps its own technical illustration: Cinema's wireframe geometry, Sound Drawing's phase portrait, CANVAS's layered media planes, LaserDMX's optical assembly, PixGrid's isometric pixel lattice, and HEADLINER's faceted performer. All artwork sits on the right at 56% card width and 170px height, with a −8° tilt. The frame, technical grid, background glow, colors, and hover treatment are shared.

Colors come from the app's `--color-*` theme tokens. Gradients and glows blend primary color with standard surfaces or transparency; titles and labels use the standard text roles. The menu surface and scrollbar also follow the appearance theme.

Cards retain their 84px height, shared 12px side inset, and 12px clearance below the window header. The combined 96px header footprint preserves the Source/Layers divider's alignment with the Presets search underline. The menu measures the remaining left-window space and scrolls internally with an 8px bottom inset. Long titles and preset names truncate while retaining their accessible labels or tooltips. Decorative artwork and empty preset lines are hidden from assistive technology.

Shared layout and artwork styling live in `src/styles/reactView.css`; display typography lives in `src/styles/typography.css`. `ReactEngineBlueprint.tsx` contains the five companion illustrations; Cinema's illustration remains in `ReactEngineBrowser.tsx`. Engine-specific comparison styling has been removed so the designs cannot drift apart.

Validation: focused ESLint passed. Browser checks and visual review at 1700px, 1180px, and 900px confirm identical frames, gradients, typography, text positions, and artwork treatment for all six engines in selected and dropdown states. Theme consistency, reserved empty preset rows, long-name truncation, tab/search alignment, compact scrolling, engine selection, Escape, and outside dismissal also passed.
