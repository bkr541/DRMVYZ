-- DRMVYZ contextual information preference
-- Controls whether hover-revealed info icons are available for the signed-in user.

alter table public.user_settings
  add column if not exists info_enabled boolean not null default true;

comment on column public.user_settings.info_enabled is
  'When true, contextual information icons appear while hovering supported controls.';
