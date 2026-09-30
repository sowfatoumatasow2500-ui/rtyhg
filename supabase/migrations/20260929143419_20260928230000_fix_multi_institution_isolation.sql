/*
# Fix Multi-Institution Isolation

## Summary
Fixes profiles RLS policies to enforce institution_id scoping.
No changes to students, teachers, or hr_staff policies.
*/

-- SELECT: user sees own profile OR same-institution profiles (with users.view perm) OR super_admin
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "select_profiles" ON public.profiles;
CREATE POLICY "select_profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_super_admin()
    OR (public.has_permission('users.view') AND institution_id = public.current_institution_id())
  );

-- INSERT: only super_admin or users.create with same institution
DROP POLICY IF EXISTS "insert_profiles" ON public.profiles;
CREATE POLICY "insert_profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_permission('users.create') AND institution_id = public.current_institution_id())
  );

-- UPDATE: user can update own profile OR admin can update same-institution profiles
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "update_profiles" ON public.profiles;
CREATE POLICY "update_profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_super_admin()
    OR (public.has_permission('users.update') AND institution_id = public.current_institution_id())
  )
  WITH CHECK (
    id = auth.uid()
    OR public.is_super_admin()
    OR (public.has_permission('users.update') AND institution_id = public.current_institution_id())
  );

-- DELETE: admin can delete same-institution profiles only
DROP POLICY IF EXISTS "delete_profiles" ON public.profiles;
CREATE POLICY "delete_profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('users.delete') AND institution_id = public.current_institution_id())
  );

-- Fix handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- SECURITY DEFINER function to safely set a user's institution
CREATE OR REPLACE FUNCTION public.set_user_institution(p_user_id uuid, p_institution_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin()
     AND NOT (public.has_permission('users.update') AND p_institution_id = public.current_institution_id())
  THEN
    RAISE EXCEPTION 'Permission insuffisante pour définir l''institution d''un utilisateur';
  END IF;

  UPDATE public.profiles
  SET institution_id = p_institution_id
  WHERE id = p_user_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_user_institution(uuid, uuid) TO authenticated;
