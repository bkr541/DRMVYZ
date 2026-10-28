# Shared boolean toggle

`IconMorphToggle`, `IconMorphCheckbox` and standalone `ToggleGlyph` use a small
circle instead of the former check/minus artwork. Off is an unfilled outline;
on is cyan with a lighter border. A 12px SVG draws a 10px outer circle, while
the existing 17px control footprint keeps row alignment and click handling stable.
The surrounding control has no fill or border. Keyboard focus, disabled styling,
switch/checkbox semantics, native form submission and reset behavior are retained.
