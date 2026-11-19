-- Rollback for 0057_builtin_model_organization.sql. Drops the built-in model tag and collection assignments (every user's); the user's own tags and collections are untouched.
DROP FUNCTION IF EXISTS public.update_builtin_model_organization(uuid, text, text[], uuid[]);
DROP FUNCTION IF EXISTS public.get_builtin_model_organization(text);
DROP TABLE IF EXISTS public.builtin_model_collection_items;
DROP TABLE IF EXISTS public.builtin_model_tags;
