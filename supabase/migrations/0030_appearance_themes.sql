-- DRMVYZ Appearance themes
-- Replace the never-implemented `system` value with the authored `cdj` theme.

update public.user_settings
set theme = 'dark'
where theme is null or theme not in ('dark', 'light', 'cdj');

alter table public.user_settings
  drop constraint if exists user_settings_theme_check;

alter table public.user_settings
  alter column theme set default 'dark';

alter table public.user_settings
  add constraint user_settings_theme_check
  check (theme in ('dark', 'light', 'cdj'));
