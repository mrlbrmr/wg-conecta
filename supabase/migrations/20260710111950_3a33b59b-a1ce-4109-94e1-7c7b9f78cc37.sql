
-- Private schema for security-definer helpers (not exposed by Data API)
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA app_private TO postgres, service_role;

-- Admin check helper (SECURITY DEFINER, in private schema so linter doesn't flag it)
CREATE OR REPLACE FUNCTION app_private.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = uid AND active = true
  );
$$;
REVOKE ALL ON FUNCTION app_private.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_admin(uuid) TO authenticated, service_role;

-- Lock down existing SECURITY DEFINER trigger function (only trigger context should call it)
REVOKE ALL ON FUNCTION public.handle_new_admin_user() FROM PUBLIC, anon, authenticated;

-- ============ admin_users: admin-only ============
DROP POLICY IF EXISTS admin_users_auth_read ON public.admin_users;
DROP POLICY IF EXISTS admin_users_auth_write ON public.admin_users;
CREATE POLICY admin_users_admin_read ON public.admin_users FOR SELECT TO authenticated
  USING (app_private.is_admin(auth.uid()));
CREATE POLICY admin_users_admin_write ON public.admin_users FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));

-- ============ portal_access: admin-only ============
DROP POLICY IF EXISTS portal_access_auth_only ON public.portal_access;
CREATE POLICY portal_access_admin_only ON public.portal_access FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));

-- ============ portal_settings: read public, write admin-only ============
DROP POLICY IF EXISTS portal_settings_write_auth ON public.portal_settings;
CREATE POLICY portal_settings_admin_write ON public.portal_settings FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));

-- ============ Content tables: restrict writes to admins ============
DROP POLICY IF EXISTS quick_links_write_auth ON public.quick_links;
CREATE POLICY quick_links_admin_write ON public.quick_links FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS announcements_write_auth ON public.announcements;
CREATE POLICY announcements_admin_write ON public.announcements FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS benefits_write_auth ON public.benefits;
CREATE POLICY benefits_admin_write ON public.benefits FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS jobs_write_auth ON public.internal_jobs;
CREATE POLICY jobs_admin_write ON public.internal_jobs FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS documents_write_auth ON public.documents;
CREATE POLICY documents_admin_write ON public.documents FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS faq_write_auth ON public.faq_items;
CREATE POLICY faq_admin_write ON public.faq_items FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS onboarding_write_auth ON public.onboarding_materials;
CREATE POLICY onboarding_admin_write ON public.onboarding_materials FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS forms_write_auth ON public.forms;
CREATE POLICY forms_admin_write ON public.forms FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS rec_write_auth ON public.recognitions;
CREATE POLICY rec_admin_write ON public.recognitions FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS camp_write_auth ON public.campaigns;
CREATE POLICY camp_admin_write ON public.campaigns FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS gg_pages_write_auth ON public.gg_pages;
CREATE POLICY gg_pages_admin_write ON public.gg_pages FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));

-- ============ PII tables: restrict reads AND writes ============
-- birthdays: remove anonymous read; admins manage
DROP POLICY IF EXISTS birthdays_read_active ON public.birthdays;
DROP POLICY IF EXISTS birthdays_write_auth ON public.birthdays;
CREATE POLICY birthdays_admin_read ON public.birthdays FOR SELECT TO authenticated
  USING (app_private.is_admin(auth.uid()));
CREATE POLICY birthdays_admin_write ON public.birthdays FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));

-- work_anniversaries
DROP POLICY IF EXISTS wa_read_active ON public.work_anniversaries;
DROP POLICY IF EXISTS wa_write_auth ON public.work_anniversaries;
CREATE POLICY wa_admin_read ON public.work_anniversaries FOR SELECT TO authenticated
  USING (app_private.is_admin(auth.uid()));
CREATE POLICY wa_admin_write ON public.work_anniversaries FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));

-- contacts
DROP POLICY IF EXISTS contacts_read_active ON public.contacts;
DROP POLICY IF EXISTS contacts_write_auth ON public.contacts;
CREATE POLICY contacts_admin_read ON public.contacts FOR SELECT TO authenticated
  USING (app_private.is_admin(auth.uid()));
CREATE POLICY contacts_admin_write ON public.contacts FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()));
