-- Atualização em tempo real
--
-- Até aqui, uma mudança feita por uma pessoa só aparecia para as outras quando a tela era
-- recarregada (ou no próximo "refetch" a cada minuto do sino). Agora, toda escrita nas tabelas
-- do portal dispara um aviso pelo Supabase Realtime no canal privado `wg-db`, e o navegador de
-- quem está logado recarrega na hora só os dados daquela tabela (`src/lib/realtime-sync.ts`).
--
-- O aviso leva **só o nome da tabela e a operação**, nunca o conteúdo da linha: quem recebe
-- continua lendo os dados pelas consultas normais, que respeitam a RLS. O canal é privado, então
-- só usuários autenticados conseguem assinar (política em `realtime.messages` abaixo).
--
-- O gatilho é por comando (FOR EACH STATEMENT), para uma importação de planilha não gerar um
-- aviso por linha. Qualquer falha no envio é engolida: o tempo real nunca pode impedir uma
-- gravação.
--
-- Idempotente.

CREATE OR REPLACE FUNCTION app_private.broadcast_table_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM realtime.send(
      jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP),
      'change',
      'wg-db',
      true
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION app_private.broadcast_table_change() FROM PUBLIC, anon, authenticated;

-- Liga o gatilho em cada tabela que o portal ou o painel mostram. Tabelas que não existirem
-- (nomes antigos) são puladas.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_users', 'anniversary_congrats', 'announcement_comments', 'announcement_reactions',
    'announcement_reads', 'announcements', 'audit_log', 'benefits', 'birthdays', 'campaigns',
    'channel_submission_messages', 'channel_submissions', 'contact_matrix', 'contacts',
    'culture_events', 'culture_photos', 'departments', 'documents', 'employee_cpf_logins',
    'employees', 'faq_items', 'forms', 'gg_pages', 'internal_jobs', 'material_views',
    'monthly_deadlines', 'onboarding_checklist_items', 'onboarding_materials',
    'onboarding_progress', 'peer_recognitions', 'portal_settings', 'profile_update_requests',
    'quick_links', 'recognitions', 'request_messages', 'requests', 'work_anniversaries'
  ]
  LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_realtime ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_realtime AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I '
      'FOR EACH STATEMENT EXECUTE FUNCTION app_private.broadcast_table_change()',
      t, t
    );
  END LOOP;
END;
$$;

-- Só quem está logado ouve o canal `wg-db`. Ninguém escreve nele pelo navegador.
DROP POLICY IF EXISTS wg_db_realtime_read ON realtime.messages;
CREATE POLICY wg_db_realtime_read ON realtime.messages FOR SELECT TO authenticated
  USING (realtime.topic() = 'wg-db' AND realtime.messages.extension = 'broadcast');
