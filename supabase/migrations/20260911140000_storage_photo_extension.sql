-- Foto do colaborador: só imagem raster
--
-- `20260903120900` conferia a pasta e o nome-base (o id), mas a extensão era livre. Pela
-- Storage API direto, sem passar pela tela, dava para gravar `employee-photos/<id>.svg` com
-- <script> ou `<id>.html` — servidos na mesma origem do portal por `/api/public/files`.
-- O proxy agora serve tudo com `nosniff` e CSP `sandbox`; isto fecha a porta na entrada.
-- Mesma lista de `uploadEmployeePhoto` (`src/lib/storage.ts`).

DROP POLICY IF EXISTS portal_public_own_photo_insert ON storage.objects;
CREATE POLICY portal_public_own_photo_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'portal-public'
    AND (storage.foldername(name))[1] = 'employee-photos'
    AND array_length(storage.foldername(name), 1) = 1
    AND split_part(storage.filename(name), '.', 1) = app_private.current_employee_id()::text
    AND storage.filename(name) ~* '^[^.]+\.(jpe?g|png|webp|avif)$'
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
    AND array_length(storage.foldername(name), 1) = 1
    AND split_part(storage.filename(name), '.', 1) = app_private.current_employee_id()::text
    AND storage.filename(name) ~* '^[^.]+\.(jpe?g|png|webp|avif)$'
  );

-- Para conferir se alguém já gravou algo fora da lista (rodar à parte):
-- SELECT name, created_at FROM storage.objects
--  WHERE bucket_id = 'portal-public' AND name LIKE 'employee-photos/%'
--    AND name !~* '\.(jpe?g|png|webp|avif)$';
