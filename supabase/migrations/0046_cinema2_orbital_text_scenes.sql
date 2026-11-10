-- Extend the existing account-owned library to ORBITAL. Preserve rows, RLS and owner/preset foreign keys.
alter table public.cinema2_saved_text drop constraint cinema2_saved_text_preset_id_check;
alter table public.cinema2_saved_text add constraint cinema2_saved_text_preset_id_check
  check (preset_id in ('drmvyz.cinema2.say-it','drmvyz.cinema2.marquee','drmvyz.cinema2.nightshift','drmvyz.cinema2.submerge','drmvyz.cinema2.orbital'));
alter table public.cinema2_text_pools drop constraint cinema2_text_pools_preset_id_check;
alter table public.cinema2_text_pools add constraint cinema2_text_pools_preset_id_check
  check (preset_id in ('drmvyz.cinema2.say-it','drmvyz.cinema2.marquee','drmvyz.cinema2.nightshift','drmvyz.cinema2.submerge','drmvyz.cinema2.orbital'));
