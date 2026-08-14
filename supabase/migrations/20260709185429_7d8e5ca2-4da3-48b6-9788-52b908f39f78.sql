
CREATE POLICY "portal_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'portal-public');
CREATE POLICY "portal_public_insert_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'portal-public');
CREATE POLICY "portal_public_update_auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'portal-public') WITH CHECK (bucket_id = 'portal-public');
CREATE POLICY "portal_public_delete_auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'portal-public');
