
-- Storage: restrict writes on portal-public bucket to admins
DROP POLICY IF EXISTS portal_public_insert_auth ON storage.objects;
DROP POLICY IF EXISTS portal_public_update_auth ON storage.objects;
DROP POLICY IF EXISTS portal_public_delete_auth ON storage.objects;

CREATE POLICY portal_public_insert_admin ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portal-public' AND app_private.is_admin(auth.uid()));

CREATE POLICY portal_public_update_admin ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'portal-public' AND app_private.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'portal-public' AND app_private.is_admin(auth.uid()));

CREATE POLICY portal_public_delete_admin ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'portal-public' AND app_private.is_admin(auth.uid()));

-- Tighten read policies: non-active/draft rows only visible to admins
DROP POLICY IF EXISTS quick_links_read_active ON public.quick_links;
CREATE POLICY quick_links_read_active ON public.quick_links
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS benefits_read_active ON public.benefits;
CREATE POLICY benefits_read_active ON public.benefits
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS documents_read_active ON public.documents;
CREATE POLICY documents_read_active ON public.documents
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS faq_read_active ON public.faq_items;
CREATE POLICY faq_read_active ON public.faq_items
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS forms_read_active ON public.forms;
CREATE POLICY forms_read_active ON public.forms
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS onboarding_read_active ON public.onboarding_materials;
CREATE POLICY onboarding_read_active ON public.onboarding_materials
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS camp_read_active ON public.campaigns;
CREATE POLICY camp_read_active ON public.campaigns
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS gg_pages_read_active ON public.gg_pages;
CREATE POLICY gg_pages_read_active ON public.gg_pages
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS rec_read_active ON public.recognitions;
CREATE POLICY rec_read_active ON public.recognitions
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS announcements_read_pub ON public.announcements;
CREATE POLICY announcements_read_pub ON public.announcements
  FOR SELECT USING (status = 'publicado' OR app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS jobs_read_pub ON public.internal_jobs;
CREATE POLICY jobs_read_pub ON public.internal_jobs
  FOR SELECT USING (status <> 'encerrada' OR app_private.is_admin(auth.uid()));
