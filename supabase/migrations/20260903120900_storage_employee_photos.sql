-- Storage: o colaborador troca a própria foto de perfil
--
-- Hoje a escrita no bucket `portal-public` é admin-only, então "Trocar foto"
-- no perfil não teria como funcionar. Abre-se a menor fresta possível:
-- só dentro de employee-photos/ e só num arquivo cujo nome é o próprio id.

DROP POLICY IF EXISTS portal_public_own_photo_insert ON storage.objects;
CREATE POLICY portal_public_own_photo_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'portal-public'
    AND (storage.foldername(name))[1] = 'employee-photos'
    AND array_length(storage.foldername(name), 1) = 1
    AND split_part(storage.filename(name), '.', 1) = app_private.current_employee_id()::text
  );

DROP POLICY IF EXISTS portal_public_own_photo_update ON storage.objects;
CREATE POLICY portal_public_own_photo_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'portal-public'
    AND (storage.foldername(name))[1] = 'employee-photos'
    AND split_part(storage.filename(name), '.', 1) = app_private.current_employee_id()::text
  )
  WITH CHECK (
    bucket_id = 'portal-public'
    AND (storage.foldername(name))[1] = 'employee-photos'
    AND split_part(storage.filename(name), '.', 1) = app_private.current_employee_id()::text
  );
