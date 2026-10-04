# Repository-Wide Codex Instructions

These instructions apply to every Codex task in this repository.

## Execution priorities

1. Finish the user-requested scope before pursuing optional investigation, broad refactors, or extra validation.
2. Keep tool usage and validation proportional to the change. Prefer focused tests and linting for the files and behavior being changed.
3. Do not repeatedly run repository-wide checks that are already known to fail for unrelated reasons. Run them only when the user requests them or the current change plausibly affects them.
4. Avoid duplicate validation. Once a relevant check has passed, rerun it only after changes that could invalidate its result.
5. When the user asks for a commit and additional work, commit the completed checkpoint first, then continue with the next step.

## Clean handoff requirement

Never present work as complete without a clean handoff. A clean handoff requires:

- the requested implementation is finished;
- relevant focused tests or checks have passed;
- applicable documentation is updated;
- the working tree and diff have been reviewed for unintended changes;
- requested commits have been created; and
- the final response clearly states the result, validation performed, commit status, and any genuine remaining limitation.

If a clean handoff cannot be reached because of a blocker or usage constraint, stop early and report the exact completed, incomplete, tested, untested, committed, and uncommitted state. Do not spend substantial additional usage without materially advancing the requested outcome.

## Communication

Keep progress updates concise. Lead with completed outcomes and concrete blockers rather than lengthy process narration.
