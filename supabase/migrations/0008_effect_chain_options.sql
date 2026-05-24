-- ============================================================
-- Migration: 0008_effect_chain_options.sql
-- Description: Shared catalog table for all Effect Chain options
--   in the VYZUALZ Effect Chain panel.
--
-- Architectural intent:
--   effect_chain_options = shared app-wide metadata catalog
--   visual_sessions      = per-session state (enabled fx, values)
--   visual_presets       = saved visual configuration state
--
-- Does NOT alter visual_sessions, visual_presets, enabled_fx,
-- effects, state persistence, or renderer toggle behavior.
-- Safe to run more than once (IF NOT EXISTS / ON CONFLICT).
-- ============================================================


-- ── Table: public.effect_chain_options ─────────────────────

create table if not exists public.effect_chain_options (
  -- Stable camelCase identifier for the Effect Chain option.
  id            text        primary key,

  -- Exact user-facing label used by the Effect Chain panel and
  -- enabledFx logic. Must stay in sync with EFFECT_CHAIN_ITEMS
  -- in EffectChainPanel.tsx (e.g. enabledFx.has('RGB Split')).
  chain_name    text        not null unique,

  -- The related VzEffects property key used by EffectControlsPanel
  -- and currently hardcoded in EFFECT_CONTROL_CHAIN_MAP.
  effect_key    text        not null unique,

  -- Human-readable description for tooltips, browsers, filtering.
  description   text        not null,

  -- Classification matching the app's VzEffectCategory type.
  category      text        not null
    check (category in ('color','distortion','audioReactive','generative','post','utility')),

  -- The related controls section in EffectControlsPanel.
  control_group text        not null
    check (control_group in ('Global','Motion','Audio Reactive','Distortion','Lighting / Atmosphere')),

  -- Preserves current display order from EFFECT_CHAIN_ITEMS.
  sort_order    integer     not null,

  -- Allows hiding retired effects without deleting metadata.
  is_available  boolean     not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

select add_updated_at_trigger('effect_chain_options');


-- ── Row Level Security ──────────────────────────────────────

alter table public.effect_chain_options enable row level security;

-- Authenticated users may read the shared catalog.
-- Only privileged roles (service_role / migrations) may write.
create policy "effect_chain_options: authenticated read"
  on public.effect_chain_options
  for select
  to authenticated
  using (true);


-- ── Indexes ─────────────────────────────────────────────────

create index if not exists idx_effect_chain_options_sort_order
  on public.effect_chain_options(sort_order);

create index if not exists idx_effect_chain_options_category
  on public.effect_chain_options(category);

create index if not exists idx_effect_chain_options_control_group
  on public.effect_chain_options(control_group);

create index if not exists idx_effect_chain_options_available
  on public.effect_chain_options(is_available);


-- ── Seed: 26 Effect Chain option definitions ────────────────
-- ON CONFLICT makes this backfill idempotent: re-running updates
-- metadata without duplicating rows.

insert into public.effect_chain_options
  (id, chain_name, effect_key, description, category, control_group, sort_order, is_available)
values
  ('rgbSplit',        'RGB Split',         'rgbSplit',        'Separates the rendered image into offset color-channel copies, producing chromatic aberration and digital glitch doubling.',                        'distortion',    'Distortion',              1,  true),
  ('glitchBars',      'Glitch Bars',        'glitchAmount',    'Slices horizontal sections of the current frame and shifts them sideways to create digital tearing artifacts.',                                    'distortion',    'Distortion',              2,  true),
  ('scanlines',       'Scanlines',          'scanlines',       'Draws horizontal dark stripes across the output to simulate CRT monitor banding.',                                                                 'post',          'Distortion',              3,  true),
  ('tunnel',          'Tunnel',             'tunnelSpeed',     'Draws animated concentric rings from the center, creating a forward-motion tunnel effect.',                                                        'generative',    'Motion',                  4,  true),
  ('displacement',    'Displacement',       'displacement',    'Offsets secondary image layers over time or beat phase to create warped motion and visual separation.',                                            'distortion',    'Motion',                  5,  true),
  ('noiseFog',        'Noise Fog',          'noiseFog',        'Adds randomized atmospheric particles over the frame, creating a hazy digital-noise texture.',                                                     'post',          'Lighting / Atmosphere',   6,  true),
  ('bloom',           'Bloom',              'bloom',           'Adds a blurred glow around bright portions of the media for a softened luminous appearance.',                                                      'post',          'Lighting / Atmosphere',   7,  true),
  ('feedback',        'Feedback',           'feedbackTrails',  'Allows previous imagery to remain beneath new frames, producing trails and accumulated motion echoes.',                                            'post',          'Lighting / Atmosphere',   8,  true),
  ('strobe',          'Strobe',             'strobe',          'Fires synchronized full-screen flashes on beats or bass transients with safety-controlled timing.',                                                'distortion',    'Lighting / Atmosphere',   9,  true),
  ('colorShift',      'Color Shift',        'colorShift',      'Rotates the overall hue palette of the rendered media and associated visual passes.',                                                              'color',         'Global',                  10, true),
  ('spectrumBars',    'Spectrum Bars',      'spectrumBars',    'Draws live vertical frequency-analysis bars that respond to the incoming audio signal.',                                                           'audioReactive', 'Audio Reactive',          11, true),
  ('circularSpectrum','Circular Spectrum',  'circularSpectrum','Arranges audio-spectrum bars radially around the canvas center, pulsing with frequency energy.',                                                   'audioReactive', 'Audio Reactive',          12, true),
  ('oscilloscope',    'Oscilloscope',       'oscilloscope',    'Draws a live waveform line from time-domain audio data.',                                                                                          'audioReactive', 'Audio Reactive',          13, true),
  ('beatRing',        'Beat Ring',          'beatRing',        'Emits expanding circular rings from the center whenever a beat is detected.',                                                                      'audioReactive', 'Audio Reactive',          14, true),
  ('particleBurst',   'Particle Burst',     'particleBurst',   'Spawns glowing particles from the center on beat hits and sends them outward before fading.',                                                      'audioReactive', 'Audio Reactive',          15, true),
  ('reactiveGrid',    'Reactive Grid',      'reactiveGrid',    'Draws a perspective neon grid whose movement and warping respond to low-frequency audio energy.',                                                  'generative',    'Audio Reactive',          16, true),
  ('cameraShake',     'Camera Shake',       'cameraShake',     'Moves the rendered scene by small randomized offsets during impacts to create bass-driven movement.',                                              'distortion',    'Motion',                  17, true),
  ('kaleidoscope',    'Kaleidoscope',       'kaleidoscope',    'Layers rotated and mirrored copies of the canvas around its center to create geometric symmetry.',                                                 'distortion',    'Motion',                  18, true),
  ('mirrorSplit',     'Mirror Split',       'mirrorSplit',     'Mirrors the rendered frame horizontally and optionally vertically to create reflected symmetry.',                                                   'distortion',    'Motion',                  19, true),
  ('radialBlur',      'Radial Blur',        'radialBlur',      'Composites scaled copies of the frame outward from the center to create zoom-blur energy.',                                                        'distortion',    'Motion',                  20, true),
  ('vhsStatic',       'VHS Static',         'vhsStatic',       'Adds analog-style noise flecks and drifting tracking lines for a damaged-tape look.',                                                              'post',          'Distortion',              21, true),
  ('datamoshSmear',   'Datamosh Smear',     'datamoshSmear',   'Reuses slightly displaced previous-frame imagery to create smeared digital-motion artifacts.',                                                     'distortion',    'Distortion',              22, true),
  ('edgeGlow',        'Edge Glow',          'edgeGlow',        'Creates a luminous glow around the canvas boundaries that reacts to audio energy.',                                                                'audioReactive', 'Lighting / Atmosphere',   23, true),
  ('colorCycle',      'Color Cycle',        'colorCycle',      'Overlays a moving multicolor gradient whose palette rotation responds to audio intensity.',                                                        'color',         'Lighting / Atmosphere',   24, true),
  ('beatFlash',       'Beat Flash',         'beatFlash',       'Produces a brief screen flash and expanding visual impact on synchronized beat boundaries.',                                                       'audioReactive', 'Lighting / Atmosphere',   25, true),
  ('edgeFlicker',     'Edge Flicker',       'edgeFlicker',     'Creates a shimmering edge vignette that activates in response to high-frequency audio energy.',                                                    'audioReactive', 'Lighting / Atmosphere',   26, true)
on conflict (id) do update set
  chain_name    = excluded.chain_name,
  effect_key    = excluded.effect_key,
  description   = excluded.description,
  category      = excluded.category,
  control_group = excluded.control_group,
  sort_order    = excluded.sort_order,
  is_available  = excluded.is_available,
  updated_at    = now();
