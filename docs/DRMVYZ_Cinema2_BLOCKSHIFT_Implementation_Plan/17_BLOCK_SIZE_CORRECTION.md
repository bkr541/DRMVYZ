# BLOCKSHIFT — Block size correction

2026-10-22. User reported that the imported objects at Block Size 1.80 were still approximately three times too small.

## Current behavior

Inspector values and saved settings remain compatible: Block Size stays 1.05–1.80, default 1.35. Those values now multiply the normalized model by **3**, producing physical sides 3.15–5.40 (default 4.05). Existing saved 1.80 therefore becomes larger immediately; no reset or manual migration is required. This supersedes the earlier interpretation of the Inspector value as direct world-unit side length.

The old bounding-sphere clearance and size-dependent baseline spacing enlarged the empty space along with the cubes. The layout now starts with authored Spread and expands only enough to separate the actual yaw-transformed model bounding boxes by at least 0.16 along a separating axis. All nine model identities and the six formation programs remain intact. Conservative finite rig radius is now 24 instead of 10.

The engine camera keeps its angle, with position `[16,11.2,38.4]`, FOV 39 degrees and minimum aspect 1.1. This combines a longer camera distance with a narrower lens to reduce perspective crowding, and removes the excessive 16:9 width reservation on the narrower in-app canvas. Actual apparent enlargement depends on aspect/position; the physical model multiplier is exactly three.

## Verification and evidence

- Focused BLOCKSHIFT tests: **17/17 PASS**, including transformed-box clearance across the geometry control extrema and all six formations, camera containment at default and the user's maximum settings at 16:9/1:1/9:16, real GLB geometry and resource lifecycle.
- Focused lint: **PASS**.
- Scoped TypeScript: **0 changed-file errors**, 4 pre-existing dependency errors. Known global TypeScript failures were not rerun.
- Targeted real-workspace browser acceptance: **PASS**. Three default aspect captures, real slider values 1.05/1.35/1.80 produce actual GPU model sides 3.15/4.05/5.40; user's Spread 1.65 and Depth 0.47 exercised. Saved 1.80 survives preset re-entry, both assets load, GPU resources balance and no page/GL errors occur.
- [Actual Inspector/canvas at the user's settings](evidence/size-correction/production-inspector.png), [maximum-size output](evidence/size-correction/size-1.8.png), [browser results](evidence/size-correction/acceptance.json), and focused logs are preserved in [evidence/size-correction](evidence/size-correction/).

Reproduce with Node 22: `node scripts/run-cinema2-blockshift-browser.mjs --sizing`. Working tree and integration diff reviewed; `git diff --check` passed. Changes remain uncommitted; no commit requested. This correction does not begin full P4 animation, audio or effects, and does not claim final user visual approval.
