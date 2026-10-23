# BLOCKSHIFT — Spread control fix

2026-10-22. Scope: correct the inert Spread slider after the larger-model update.

## Cause and fix

Spread previously multiplied all initial positions before the minimum-clearance calculation. With the larger models, that calculation applied the inverse multiplier to restore the same tightly packed result. The authored Spread value changed while the rendered formation barely moved.

Spread now directly controls the minimum gap between transformed model bounding boxes: `0.16 + (Spread - 0.5) * 0.4` world units. Slider 0.50 means a 0.16 gap; 1.00 means 0.36; 1.80 means 0.68. Clearance is resolved from a fixed reference formation, so it cannot cancel the slider. Block size, object identity, materials and authored settings remain independent. A regression checks strict spacing increases even from 0.50 to 0.51 across all six formations and three block sizes.

The camera FOV is widened slightly from 39 to 41.5 degrees to accommodate the new separation while retaining the larger physical models and camera angle. Finite rig envelope increases from radius 24 to 26. These values supersede the framing/clearance defaults in the prior size report.

## Validation

- Focused BLOCKSHIFT tests: **18/18 PASS**, including clearance extrema, continuous Spread response without model resizing, six formations and default/user-maximum camera containment at wide/square/portrait.
- Focused lint and real-workspace browser check: **PASS**. Actual GPU formation radius and rendered pixels increase from Spread 0.50 → 1.00 → 1.80, all model sides remain 5.40, preset re-entry restores Spread 1.65, GPU resource counts balance and no page/GL errors occur.
- Browser scope: real Inspector Spread 0.50/1.00/1.80 at Block Size 1.80 and Depth 0.47, actual GPU position changes, unchanged physical model side 5.40, visible pixel differences, preset re-entry and saved Spread 1.65.

Reproduce with Node 22: `node scripts/run-cinema2-blockshift-browser.mjs --spread`. Evidence is stored in [evidence/spread-fix](evidence/spread-fix/), including [minimum spread](evidence/spread-fix/spread-0.5.png), [maximum spread](evidence/spread-fix/spread-1.8.png), [Inspector](evidence/spread-fix/production-inspector.png), and [acceptance results](evidence/spread-fix/acceptance.json). Working tree and affected source reviewed; `git diff --check` passed. The known repository-wide TypeScript baseline was not rerun for this arithmetic/control correction. Changes remain uncommitted; no commit requested. Full P4 motion and later audio/effects remain outside this fix.
