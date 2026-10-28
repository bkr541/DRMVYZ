# Cathedral loop gap

Cathedral's 106.8-unit repeat consists of an 82.8-unit pointed-arch aisle and a
24-unit LED transition room. The camera advances continuously through these
sections on a 52-second authored lap, adjusted by the existing tempo controls.

Previously the renderer drew one copy of the installation and moved that whole
copy forward only when the camera crossed the lap boundary. Near the transition
room's exit, the next aisle was absent from the forward view, producing a large
black space before the installation reappeared.

The renderer now draws the current copy and the next copy, separated by exactly
one repeat distance. The next aisle is visible through the exit before the camera
crosses the boundary; after crossing, it becomes the current copy. Both copies
share the existing vertex/index/instance buffers and lighting/choreography state.
This adds one instanced draw per frame, with no additional geometry buffers.
Camera timing, the transition room and the existing lighting remain unchanged.

The six Cathedral unit tests pass, including production rendering of both copies
and verification that subsequent frames allocate no extra buffers. Scoped ESLint
and whitespace checks pass. Run the focused visual regression with:

```sh
node scripts/cinema2-assets/accept-cathedral-loop.mjs
```

It samples nine rendered frames in the transition rooms and around the first
two loop boundaries, checks visible architecture and render health, and writes
captures and measurements to `artifacts/cinema2-cathedral-loop/`.
All nine samples pass, with no browser, shader or render failures. Captures
immediately before and after the first boundary were visually reviewed: the
next aisle remains present throughout. Live desktop playback was not tested.
Changes remain uncommitted; no commit was requested.
