# [Task title]

<!--
UNIVERSAL CODE-CHANGE PROMPT TEMPLATE

Purpose:
Use this template for bug fixes, new features, enhancements, integrations, refactors,
performance work, architecture changes, migrations, test coverage, and staged implementation.

How to use:
1. Replace every bracketed placeholder that applies.
2. Delete optional sections that do not apply.
3. Keep facts, assumptions, and implementation suggestions separate.
4. Attach the authoritative repository and all relevant artifacts in the same conversation.
5. For staged work, copy this template for each stage and update the prior-stage context.
6. Do not include speculative filenames or line numbers unless they were verified in the
   authoritative source.
-->

## 1. Task and deliverable

**Project:** [Project or application name]

**Task type:** [Corrective bug fix | New feature | Enhancement | Production integration | Refactor | Architecture audit | Performance optimization | Security hardening | Migration | Test coverage | Other]

**Complexity:** [Focused single-subsystem change | Cross-subsystem integration change | Repository-wide architecture change | Unknown until investigated]

**Primary deliverable:** [Exact deliverable, such as one apply-ready `.patch` file named `...`]

**Task summary:**

[Give the implementer a direct, action-oriented instruction. State what must be analyzed, changed, and returned.]

### Delivery rules

- [Modify the supplied repository directly.]
- [Return one consolidated deliverable.]
- [Do not return only advice, pseudocode, or isolated snippets.]
- [Avoid unrelated refactors, naming churn, dependency changes, or visual redesigns.]
- [Keep changes additive and localized where practical.]
- [Do not claim runtime validation based only on source inspection.]
- [Report any behavior that could not be executed or verified.]
- [Add any deliverable-specific rules.]

---

## 2. Application or system overview

<!--
Give enough context to understand the product without requiring the implementer to rediscover
the entire application before examining the requested subsystem. Keep this concise and stable.
-->

[Describe what the application does, its primary users, major subsystems, and the role of the subsystem affected by this request.]

### High-level system flow

```text
[User or external input]
→ [UI or API entry point]
→ [state or domain layer]
→ [runtime or service layer]
→ [renderer, database, external API, output, or other final system]
```

### Neighboring systems that must remain unchanged

- [Subsystem or feature]
- [Subsystem or feature]
- [Public interface, integration, or user workflow]

---

## 3. Stage context and prior work

<!--
Required for multi-stage feature work or when earlier patches may already be applied.
Delete this section for a truly isolated task.
-->

**Stage:** [Stage X of Y, or standalone]

### Expected prior changes

1. **[Prior patch, pull request, commit, or stage name]**
   - [What it was intended to establish]
   - [What it intentionally did not implement]

2. **[Prior patch, pull request, commit, or stage name]**
   - [What it was intended to establish]
   - [What it intentionally did not implement]

### Stage rules

- Treat the supplied repository as authoritative, even if it differs from the descriptions above.
- Verify that prior work is present and reachable through the real production path.
- Do not assume a prior stage succeeded merely because related files or tests exist.
- [Repair small prerequisite defects only when necessary for this stage, and report them.]
- [Do not absorb work reserved for later stages.]

---

## 4. Source of truth and environment

**Authoritative source:** [Attached complete repository | Linked branch or commit | Minimal reproduction | Specific files]

**Branch, commit, version, or build:** [Exact identifier, if known]

**Runtime and platform:** [Operating system, browser, mobile platform, server runtime, framework, language, database, GPU path, etc.]

**Launch or setup command:** `[Command, if known]`

**Known validation commands:**

```text
[Type-check command]
[Test command]
[Build command]
[Integration or browser test command]
[Other relevant command]
```

### Source rules

- Treat the supplied source as authoritative.
- Do not infer the current architecture from older repositories, earlier conversations, or stale patches.
- Discover actual filenames, module boundaries, interfaces, and scripts from the supplied source.
- If attached artifacts conflict, use this priority order:
  1. [Primary authoritative source]
  2. [Secondary source]
  3. [Behavioral evidence]
- [Add repository-specific source rules.]

---

## 5. Product-level outcome

<!--
Describe the result in user or operator terms, not only as code changes.
-->

After this change:

- [The user can see or do X.]
- [The system behaves as Y.]
- [Saved, loaded, imported, exported, or synchronized state behaves as Z.]
- [The real production runtime uses the corrected or new implementation.]

**Success must be observed in:**

- [Real application UI]
- [API or service path]
- [Saved-project or persisted-state reload]
- [Supported renderer, browser, platform, or environment]
- [Other production context]

---

## 6. User or operator workflow

<!--
Describe the real path a person or external client follows. This becomes the backbone of
integration testing.
-->

1. [Open, launch, authenticate, or initialize the application.]
2. [Navigate to the affected feature.]
3. [Create, upload, select, or configure the relevant input.]
4. [Perform the action that invokes the feature.]
5. [Observe or interact with the result.]
6. [Exercise save, reload, seek, loop, reconnect, refresh, undo, or other lifecycle actions.]
7. [Confirm neighboring behavior remains unchanged.]

---

## 7. Confirmed current behavior or current foundation state

<!--
For a bug: describe what actually happens.
For a new feature: describe what already exists and what is intentionally missing.
Do not place suspected causes here.
-->

[Describe only observed runtime behavior, verified source state, logs, tests, or known foundation work.]

**Frequency:** [Always | Usually | Intermittent | After reload | At boundaries | Environment-specific | Unknown | Not applicable]

**Regression status:** [Known regression | Longstanding defect | Introduced recently | New feature not yet implemented | New feature partially implemented | Unknown | Not applicable]

### Evidence

- [Screenshot or recording reference]
- [Timestamp]
- [Console error]
- [Log excerpt]
- [Failing test]
- [Observed state]
- [Source-inspection fact]

---

## 8. Deterministic reproduction

<!--
Usually required for defects. For a new feature, replace this with a deterministic setup path.
Use one action per step and enter through the real application.
-->

1. [Start from a clean, defined state.]
2. [Launch the authoritative build.]
3. [Navigate through the real production UI or API.]
4. [Supply the required input.]
5. [Perform the action.]
6. [Observe the current incorrect or incomplete behavior.]
7. [Repeat lifecycle conditions such as reload, seek, loop, reconnect, or platform switch.]

### Required setup data

- [Account, fixture, project, file, record, track, image, or configuration]
- [Feature flags]
- [Environment variables]
- [Permissions or roles]

---

## 9. Expected behavior

<!--
Write statements that can become pass/fail tests.
-->

- [Expected behavior 1]
- [Expected behavior 2]
- [Expected behavior 3]
- [Expected behavior after reload or re-entry]
- [Expected behavior at a boundary or error condition]
- [Expected neighboring behavior that must remain unchanged]

---

## 10. Fixed decisions and implementation latitude

### Fixed product or architecture decisions

<!--
These are requirements, not suggestions.
-->

- [Stable feature name or user-facing label]
- [Required behavior]
- [Required supported media, platforms, formats, or data]
- [Required ownership rule]
- [Required compatibility behavior]
- [Explicitly deferred work]
- [Forbidden shared-system changes]

### Open implementation decisions

<!--
The implementer may choose these after inspecting the repository.
-->

- [Exact module or filename organization]
- [Internal helper design]
- [Algorithm details]
- [Test organization]
- [Performance strategy]
- [Migration implementation details]

Choose implementation details from repository evidence. Mandatory outcomes and acceptance criteria take priority over suggested internals.

---

## 11. Current architecture snapshot

<!--
Provide a compass, not a substitute for investigation.
-->

### Intended production path

```text
[UI, API, event, or import entry]
→ [registry, router, controller, command, or service]
→ [canonical state or domain model]
→ [normalization, validation, hydration, or migration]
→ [runtime selection or execution]
→ [renderer, database, external system, or output]
```

### Existing architectural conventions to reuse

- [Canonical store or domain owner]
- [Shared component or control system]
- [Existing renderer or service pattern]
- [Existing deterministic utilities]
- [Existing migration or serialization framework]
- [Existing error-handling or telemetry pattern]

This snapshot is a hypothesis to verify against the supplied source, not permission to skip investigation.

---

## 12. Stable identifiers and external contracts

<!--
List identifiers that should remain stable even if filenames or implementation details change.
-->

| Identifier | Exact value | Owner | Compatibility requirement |
|---|---|---|---|
| [Feature or preset ID] | `[value]` | [Owner] | [Must remain stable or may be introduced] |
| [Route or API endpoint] | `[value]` | [Owner] | [Compatibility rule] |
| [Schema or storage key] | `[value]` | [Owner] | [Migration rule] |
| [Event or action name] | `[value]` | [Owner] | [Compatibility rule] |
| [Public type or interface] | `[value]` | [Owner] | [Compatibility rule] |

### External interfaces

- [API request or response contract]
- [Database schema or table contract]
- [Plugin, extension, or public module interface]
- [File format or export contract]
- [URL, route, CLI, message, or event contract]

---

## 13. Architecture and ownership rules

<!--
State who owns each kind of truth. This prevents duplicate state and competing runtimes.
-->

| Subsystem or component | Owns | Must not own |
|---|---|---|
| [UI] | [User intent and dispatch] | [Duplicated domain state] |
| [Store or domain layer] | [Canonical persisted state] | [Renderer resources] |
| [Runtime or service] | [Execution and lifecycle] | [Unrelated global policy] |
| [Renderer or adapter] | [Derived per-frame or per-request behavior] | [Canonical persistence] |
| [Migration layer] | [Old-to-new state conversion] | [Runtime decisions] |
| [Shared subsystem] | [Existing shared capability] | [Feature-specific duplication] |

### Single-source-of-truth rules

- [Canonical owner of persisted state]
- [Canonical owner of derived state]
- [Canonical owner of timing or event identity]
- [Canonical owner of external data]
- [Canonical owner of user preferences]

---

## 14. Parameter, control, or interface contract

<!--
Use for UI-heavy features, APIs, configuration, automation, command handlers, or public methods.
Delete if not applicable.
-->

### Cinema 2.0 preset parent-group requirement

When a task creates, ports, changes, or reorganizes a Cinema 2.0 preset, every user-facing parameter or nested parameter group rendered within that preset's Design inspector hierarchy must be contained under one of these four top-level parent groups:

- **Master Controls**
- **Design**
- **Effects**
- **Palette**

Nested groups are allowed beneath these parent groups. This requirement defines only the top-level Inspector hierarchy. It must not hard-code or whitelist parameter names, subgroup names, parameter counts, control types, ranges, behaviors, runtime bindings, ownership modes, or preset-specific implementation details. A Cinema 2.0 preset may introduce whatever parameters and nested groups its design requires, provided their Design-inspector placement resolves under one of the four parent groups.

Do not satisfy this requirement by matching specific parameter labels or preset-specific names in shared Inspector code. The grouping mechanism must remain generic enough for current and future Cinema 2.0 presets.

| UI label, field, or API property | Type | Default | Range or options | State owner | Runtime effect | Persisted? |
|---|---|---:|---|---|---|---|
| [Name] | [Slider, boolean, enum, string, object, action] | [Default] | [Range or values] | [Owner] | [Effect] | [Yes, No, Derived, Command] |
| [Name] | [Type] | [Default] | [Range or values] | [Owner] | [Effect] | [Yes, No, Derived, Command] |

### Action semantics

<!--
Clarify buttons and commands so they are not incorrectly stored as permanent booleans.
-->

| Action | What changes | What must remain unchanged | Persisted representation |
|---|---|---|---|
| [Action name] | [Identity, state, request, or transition] | [Invariant] | [None, counter, command ID, event record, etc.] |

### Validation and normalization

- [Enum fallback behavior]
- [Numeric clamping]
- [Required-field handling]
- [Malformed-input behavior]
- [Unknown-version behavior]
- [Permission or authorization validation]

---

## 15. State, persistence, and data contract

<!--
Use for saved projects, databases, caches, undo/redo, import/export, local storage, sessions,
or any feature with durable or reconstructed state.
-->

### Persisted state

- [Field or entity]
- [Field or entity]
- [Schema version or storage key]

### Derived or runtime-only state

Do not persist:

- [Interpolated or transient values]
- [Runtime resources]
- [Caches]
- [Connections, handles, or decoders]
- [Temporary audio, animation, or request envelopes]
- [Other reconstructable state]

### Reconstruction inputs

Derived state must be reconstructable from:

- [Persisted settings]
- [Stable identity]
- [Source data or media identity]
- [Transport, request, or timeline position]
- [Versioned algorithm or migration rule]

### Migration requirements

- Current schema version: [Version or unknown]
- Target schema version: [Version or determine after inspection]
- [Load old data safely.]
- [Add missing fields using defaults.]
- [Preserve unrelated values.]
- [Normalize malformed values.]
- [Do not rewrite unaffected data eagerly.]

### Lifecycle and invalidation

Invalidate or rebuild derived state when:

- [Source changes]
- [Revision changes]
- [User signs out or changes workspace]
- [Renderer or service restarts]
- [Schema migration occurs]
- [Viewport, device, or platform changes]
- [Other lifecycle event]

### Undo, redo, import, export, and deletion

- [What participates in undo/redo]
- [What import/export must include]
- [What deletion must remove]
- [What dependent references must be preserved or cleared]
- [Rollback behavior after failure]

---

## 16. Confirmed facts, hypotheses, and rejected approaches

### Confirmed facts

<!--
Only include facts proven by runtime evidence, source inspection, logs, tests, or documentation.
-->

- [Confirmed fact]
- [Confirmed fact]
- [Confirmed fact]

### Suspected causes or design hypotheses

<!--
These are investigation leads, not instructions to obey blindly.
-->

- [Hypothesis]
- [Hypothesis]
- [Hypothesis]

Treat every suspected cause as a hypothesis. Verify it against the authoritative repository and runtime evidence before editing.

### Known failed, rejected, or unsafe approaches

- [Prior patch or approach that did not solve the production problem]
- [Duplicate runtime or source of truth to avoid]
- [Test-only helper that did not prove real integration]
- [Tuning-only change that masked the problem]
- [Architectural approach that violates requirements]

---

## 17. Required investigation

Before changing code, trace the real production path:

```text
[Entry point]
→ [selection or dispatch]
→ [state ownership]
→ [validation, hydration, or migration]
→ [runtime execution]
→ [final output]
```

### Required repository searches

- Search every reference to affected IDs, aliases, routes, keys, events, and public types.
- Verify runtime reachability from the real application entry point.
- Inspect serialization, hydration, migration, import, export, and saved-state reconstruction.
- Identify duplicate implementations, stale paths, feature flags, and legacy fallbacks.
- Separate production paths from fixtures, previews, stories, demos, and test-only helpers.
- Trace state ownership and mutation across subsystem boundaries.
- Inspect caches, memoization, defaults, and invalidation behavior.
- Inspect renderer, platform, browser, server, or environment-specific branches.
- Inspect failure, rollback, cleanup, cancellation, and retry behavior.
- Before creating any new UI component, control, layout primitive, styling pattern, CSS class, modal, dropdown, button, collapsible, slider, input, tooltip, menu, or panel, search the repository for an existing shared/app-wide implementation and reuse it whenever it satisfies the requirement.
- [Add task-specific investigation requirements.]

Do not conclude that code is active merely because it is imported, exported, registered, or tested. Prove production reachability.

---

## 18. Implementation requirements

<!--
Describe the required change in coherent work packages. This is where feature-specific detail belongs.
Use as many subsections as needed.
-->

### 18.1 [Work package or subsystem]

- [Required change]
- [Required behavior]
- [Ownership rule]
- [Failure behavior]
- [Compatibility requirement]

### 18.2 [Work package or subsystem]

- [Required change]
- [Required behavior]
- [Ownership rule]
- [Failure behavior]
- [Compatibility requirement]

### 18.3 [Work package or subsystem]

- [Required change]
- [Required behavior]
- [Ownership rule]
- [Failure behavior]
- [Compatibility requirement]

### Error and fallback behavior

- [What happens when input is missing]
- [What happens when a dependency fails]
- [What happens on unsupported platforms]
- [What happens on timeout, cancellation, context loss, or reconnect]
- [Whether fallback behavior must match an existing feature]

---

## 19. Scope and non-goals

### In scope

- [Required production change]
- [Required state or migration work]
- [Required UI, API, runtime, or service integration]
- [Required tests]
- [Required documentation or reporting]

### Out of scope

- [Explicitly deferred feature]
- [Unrelated redesign]
- [Unrelated refactor]
- [New dependency or subsystem]
- [Future-stage work]
- [Platform or format not included]

The listed likely areas must not limit repository investigation when another path is necessary to establish the correct implementation.

---

## 20. Compatibility matrix

<!--
Use for features that cross media types, platforms, runtime modes, saved-state versions,
permissions, renderers, browsers, or connectivity states.
-->

| Context | Required behavior |
|---|---|
| [Primary platform or runtime] | [Required behavior] |
| [Fallback platform or runtime] | [Required behavior] |
| [Fresh project or clean state] | [Required behavior] |
| [Migrated or existing state] | [Required behavior] |
| [Online] | [Required behavior] |
| [Offline or degraded dependency] | [Required behavior] |
| [Feature flag on] | [Required behavior] |
| [Feature flag off] | [Required behavior] |
| [Permission or role] | [Required behavior] |
| [Input or media type] | [Required behavior] |

---

## 21. Required invariants and implementation constraints

### Required invariants

- [The same stable input produces the same stable output.]
- [Saved data remains compatible.]
- [Public identifiers remain stable.]
- [Canonical state has one owner.]
- [Existing neighboring behavior remains unchanged.]
- [Failed operations leave state consistent.]
- [Cancellation does not commit partial state.]
- [Reload or re-entry reconstructs the same valid state.]
- [Add task-specific invariants.]

### Implementation constraints

- Preserve saved-state compatibility.
- Preserve public interfaces unless an intentional breaking change is explicitly approved.
- Do not create a second source of truth.
- Do not add test-only hooks to production code.
- Do not add dependencies without necessity and justification.
- Do not use nondeterministic or frame-order-dependent state where determinism is required.
- Reuse canonical shared architecture where appropriate.
- Keep changes localized and coherent.
- [Do not modify named shared subsystems.]
- [Do not alter unrelated database tables, routes, or rendering paths.]
- [Add technology-specific constraints.]

### AI-generated filler text and copy discipline

- Do not add explanatory, decorative, instructional, promotional, placeholder, or AI-generated text unless the requested feature actually requires it.
- Do not invent labels, subtitles, descriptions, tooltips, empty-state messages, comments, headings, notices, helper copy, onboarding text, success messages, informational cards, or other user-facing prose merely to make an implementation appear more complete, polished, or comprehensive.
- If the requested change does not require new user-facing text, assume that no new user-facing text should be introduced.
- Reuse existing application terminology and established copy patterns when text is required. Do not replace concise existing wording with verbose, generic, or stylistically embellished AI-generated language unless explicitly requested.
- Do not add code comments or documentation that merely restate what clearly readable code already does. Add comments only when they explain non-obvious intent, constraints, invariants, compatibility requirements, architectural reasoning, or other information that is not self-evident from the code.
- Accessibility-required text, error messages necessary for correct operation, and text explicitly required by the task are allowed, but they should remain concise and consistent with existing application conventions.

---

## 22. Non-functional requirements

<!--
Specify performance, reliability, security, accessibility, operability, and maintainability.
Delete categories that do not apply.
-->

### Performance

- Target: [Resolution, throughput, latency, memory, startup, bundle size, requests per second, etc.]
- [Avoid per-item DOM nodes or decoders.]
- [Avoid allocation-heavy work in hot loops.]
- [Reuse buffers, resources, or connections.]
- [Define static or adaptive quality limits.]

### Reliability and lifecycle

- [Handle initialization failure.]
- [Handle cancellation.]
- [Handle reconnect or context restoration.]
- [Clean up listeners, timers, workers, resources, and subscriptions.]
- [Prevent duplicate loops, requests, or handlers.]
- [Define rollback behavior.]

### Security and privacy

- [Authorization rule]
- [Input sanitization]
- [Secret handling]
- [Data isolation]
- [Logging restrictions]
- [Dependency or supply-chain requirements]

### Accessibility and usability

- [Keyboard behavior]
- [Screen-reader labels]
- [Focus management]
- [Color or motion safety]
- [Error messaging]
- [Responsive behavior]

### Maintainability and observability

- [Clear module boundaries]
- [No duplicated business logic]
- [Structured logging]
- [Metrics or tracing]
- [Useful error context]
- [Documentation or comments for non-obvious algorithms]

---

## 23. Architectural traps to avoid

<!--
List tempting implementations that would technically appear to work but violate the intended architecture.
-->

- Do not [create duplicate state or runtime ownership].
- Do not [implement production behavior only in a preview, fixture, story, demo, or test helper].
- Do not [infer a specialized path from an unrelated setting].
- Do not [create one heavyweight resource per visual item, row, task, or fragment].
- Do not [persist transient renderer, request, audio, or animation state].
- Do not [duplicate an existing shared analysis or service].
- Do not [use uncontrolled randomness where seek, replay, retry, or reproducibility matters].
- Do not [silently swallow errors or leave partial state].
- Do not [solve a cross-subsystem defect with an isolated local patch that bypasses canonical ownership].
- [Add task-specific traps.]

---

## 24. Acceptance criteria

The work is complete only if all applicable criteria are demonstrably true:

1. [Observable pass/fail criterion]
2. [Observable pass/fail criterion]
3. [Real production path criterion]
4. [Persistence or migration criterion]
5. [Error or fallback criterion]
6. [Compatibility criterion]
7. [Performance or lifecycle criterion]
8. [No-regression criterion]
9. [Test criterion]
10. [Deliverable criterion]

Avoid vague criteria such as “works correctly,” “looks good,” or “is optimized” without a measurable definition.

---

## 25. Required tests

Add or update tests covering:

- Unit tests for deterministic or pure logic.
- Production integration tests entering through the real UI, API, runtime, or service path.
- Serialization, hydration, migration, import, and export tests.
- Boundary-condition tests.
- Error, cancellation, rollback, and retry tests.
- Platform, renderer, browser, or environment parity tests.
- Regression tests for neighboring behavior.
- A test proving a legacy or incorrect path is no longer selected, when applicable.
- [Task-specific test]
- [Task-specific test]

At least one test must enter through the real production selection and execution path rather than validating only an isolated helper.

### Test harness requirements

- [Real store, router, database, renderer, service, or dependency boundary to mount]
- [Fixtures or sample data]
- [Mocking restrictions]
- [Browser or integration harness]
- [Performance harness]

---

## 26. Falsification attempts

Before finalizing, attempt to disprove the implementation using:

- Fresh state and migrated state.
- Reload, re-entry, navigation away and back.
- Undo, redo, cancellation, failure, and retry.
- Minimum, maximum, empty, malformed, and unknown values.
- Rapid repeated actions.
- Source, account, workspace, media, or project replacement.
- Boundary transitions.
- Offline or degraded dependency behavior.
- Platform, renderer, browser, or device changes.
- Feature flags, permissions, and role changes.
- Resource cleanup after unmount, shutdown, or disconnect.
- [Task-specific scenario]
- [Task-specific scenario]

Document which falsification attempts were executed and their results.

---

## 27. Required stage handoff

<!--
Use for staged work. Delete for a standalone final task.
-->

This stage must leave the following stable extension points for the next stage:

- [Interface, type, or module boundary]
- [Stable IDs or state fields]
- [Testable pure logic]
- [Renderer, service, or adapter contract]
- [Lifecycle hook]
- [Migration or compatibility support]
- [Reserved field or capability]

This stage must not implement:

- [Future-stage feature]
- [Future-stage feature]
- [Future-stage integration]

---

## 28. Validation and required implementation evidence

Run the relevant type checks, tests, builds, linters, migrations, production integration tests, and browser or runtime harnesses.

### Known commands

```text
[Command]
[Command]
[Command]
```

If exact commands are not provided, discover them from the authoritative repository.

### Required evidence

The final report must identify:

- The exact production entry point used.
- The production path traced.
- The canonical state, service, or domain owner used.
- The runtime-selection or execution branch reached.
- The migration or hydration path exercised.
- The test proving production reachability.
- The test proving the most important invariant.
- The test proving neighboring behavior remains unchanged.
- Any runtime path that could not be executed.
- Any platform, renderer, database, or external integration that remains unverified.

### Visual or interactive evidence, when applicable

- [Screenshot or recording produced]
- [Input or media used]
- [Platform or renderer used]
- [Quality or configuration used]
- [Playback, seek, loop, reload, or interaction scenario tested]

Do not claim runtime validation for behavior established only through source inspection.

---

## 29. Required final report

Provide:

1. A concise implementation summary.
2. The root cause or missing architecture, when applicable.
3. The production path traced.
4. Architecture and ownership decisions.
5. Every file changed and why.
6. State, migration, and compatibility changes.
7. Tests added or updated.
8. Commands run and exact results.
9. Falsification attempts and results.
10. Performance or lifecycle findings.
11. Unverified behavior, test gaps, and remaining limitations.
12. Deliverable application or installation instructions.

---

## 30. Attached artifact manifest

<!--
List every artifact attached with the prompt. Use hashes when exact file identity matters.
-->

1. **[Repository, file, screenshot, recording, log, fixture, or sample data]**
   - Role: [Authoritative source | Behavioral evidence | Reference | Test fixture]
   - Type: [File type]
   - Version or date: [Value]
   - SHA-256: `[Optional hash]`

2. **[Artifact]**
   - Role: [Role]
   - Type: [File type]
   - Version or date: [Value]
   - SHA-256: `[Optional hash]`

### Artifact instructions

- [Which artifact is authoritative.]
- [Which artifact demonstrates current behavior.]
- [Which fixture must be used for validation.]
- [Which images are visual references rather than exact output specifications.]
- [Any timestamp, page, filename, or scenario mapping.]

---

# Optional compact checklist

<!--
Use this before sending the prompt. Delete it from the final request if desired.
-->

- [ ] The exact deliverable and filename are specified.
- [ ] The authoritative source is unambiguous.
- [ ] The application overview is concise but sufficient.
- [ ] Prior stages and current stage boundaries are clear.
- [ ] Current behavior is separated from suspected causes.
- [ ] The real user or API workflow is documented.
- [ ] Fixed decisions are separated from implementation latitude.
- [ ] Canonical ownership and production path are identified.
- [ ] Parameters, persistence, and commands have explicit contracts.
- [ ] Scope and non-goals are both present.
- [ ] Compatibility and non-functional requirements are defined.
- [ ] Architectural traps are listed.
- [ ] Acceptance criteria are observable and testable.
- [ ] At least one test enters through the real production path.
- [ ] Falsification scenarios include lifecycle and boundary cases.
- [ ] Required validation evidence and final reporting are explicit.
- [ ] Every attached artifact has a stated role.
