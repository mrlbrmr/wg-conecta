-- Retenção do Baterito e limites do bucket de anexos
--
-- 1. `baterito_queries` guarda cada pergunta (com PII mascarada) para rate limit e para o
--    relatório de lacunas. O handoff pede 90 dias; não havia nada apagando.
-- 2. `request-attachments` recebe atestados e comprovantes. O limite de 10 MB e os tipos
--    (PDF, JPG, PNG) só existiam na tela (`uploadRequestAttachment`); pela Storage API dava
--    para subir qualquer coisa de qualquer tamanho.

-- ── 1. Retenção de 90 dias ────────────────────────────────────────────
DELETE FROM public.baterito_queries WHERE created_at < now() - interval '90 days';

-- Agenda a limpeza diária se o pg_cron estiver habilitado (Database → Extensions no painel
-- do Supabase). Sem ele, a migration só avisa: rode o DELETE acima de tempos em tempos.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'baterito-retencao';
    PERFORM cron.schedule(
      'baterito-retencao',
      '0 4 * * *',
      $job$DELETE FROM public.baterito_queries WHERE created_at < now() - interval '90 days'$job$
    );
  ELSE
    RAISE NOTICE 'pg_cron não está habilitado: a retenção de baterito_queries não foi agendada.';
  END IF;
END $$;

-- ── 2. Anexos: tipo e tamanho no próprio bucket ───────────────────────
-- Mesmos números de `ATTACHMENT_MAX_BYTES` e `ATTACHMENT_EXTENSIONS` (`src/lib/storage.ts`).
UPDATE storage.buckets
   SET file_size_limit    = 10485760,
       allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png']
 WHERE id = 'request-attachments';
