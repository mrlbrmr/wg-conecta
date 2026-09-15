-- Canais de escuta do portal: SIM (Sistema Interno de Melhorias) e, no PR seguinte, o Canal de
-- Escuta. Os dois aceitam envio sem identificação.
--
-- - SIM: sugestões, críticas e elogios sobre qualquer assunto da empresa (antes um Google Forms).
--   A pessoa escolhe entre enviar com o nome ou sem se identificar.
-- - Canal de Escuta: relatos de assédio, discriminação, conduta antiética, segurança. A Lei
--   14.457/2022 pede às empresas com CIPA um canal de denúncias de assédio com anonimato. Aqui
--   o envio é **sempre** sem autor — a constraint `channel_submissions_escuta_sem_autor` garante.
--
-- `requests` não serve: exige `employee_id` e amarra RLS, anexo e conversa à identidade.
--
-- Envio sem identificação — **nada que ligue a linha a quem escreveu**:
-- - `author_employee_id` fica nulo e não há outra coluna de autor (nem auth uid, nem IP);
-- - só a data do envio, sem hora (`received_on`), para dificultar cruzar com quem estava online;
-- - `updated_at` nasce vazio e só muda quando o G&G mexe;
-- - nada de trigger de auditoria nesta tabela.
-- Quem enviou acompanha com protocolo + chave, entregues só a ela. A chave fica em hash.
--
-- Envio identificado (só no SIM): `author_employee_id` vem do login, no servidor — não dá para
-- enviar em nome de outra pessoa. O acompanhamento é pelo Perfil, sem chave.
--
-- Acesso só pelo servidor (service role): RLS ligada, nenhuma policy, nenhum GRANT para
-- `anon`/`authenticated`. O painel lê por server functions com `requireAdmin`.

CREATE TABLE IF NOT EXISTS public.channel_submissions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel            TEXT NOT NULL CHECK (channel IN ('sim', 'escuta')),
  protocol           TEXT NOT NULL UNIQUE,
  -- Nulo nos envios identificados, que se acompanham pelo Perfil.
  access_key_hash    TEXT,
  author_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  category           TEXT NOT NULL,
  payload            JSONB NOT NULL DEFAULT '{}'::jsonb,
  status             TEXT NOT NULL DEFAULT 'recebido'
                     CHECK (status IN ('recebido', 'em_analise', 'concluido')),
  received_on        DATE NOT NULL,
  updated_at         TIMESTAMPTZ,
  CONSTRAINT channel_submissions_escuta_sem_autor
    CHECK (channel = 'sim' OR author_employee_id IS NULL)
);

CREATE INDEX IF NOT EXISTS channel_submissions_channel_idx
  ON public.channel_submissions (channel, received_on DESC);

CREATE INDEX IF NOT EXISTS channel_submissions_author_idx
  ON public.channel_submissions (author_employee_id)
  WHERE author_employee_id IS NOT NULL;

-- A conversa também sem hora: `seq` dá a ordem, `sent_on` só o dia.
CREATE TABLE IF NOT EXISTS public.channel_submission_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq           BIGINT GENERATED ALWAYS AS IDENTITY,
  submission_id UUID NOT NULL REFERENCES public.channel_submissions(id) ON DELETE CASCADE,
  from_gg       BOOLEAN NOT NULL,
  body          TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  sent_on       DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS channel_submission_messages_submission_idx
  ON public.channel_submission_messages (submission_id, seq);

ALTER TABLE public.channel_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_submission_messages ENABLE ROW LEVEL SECURITY;

-- Os privilégios padrão deste projeto dão ALL em tabela nova para anon e authenticated.
REVOKE ALL ON public.channel_submissions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.channel_submission_messages FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.channel_submissions TO service_role;
GRANT ALL ON public.channel_submission_messages TO service_role;

COMMENT ON TABLE public.channel_submissions IS
  'SIM e Canal de Escuta. Sem hora do envio, de propósito; autor só no SIM identificado. Acesso só pelo servidor.';
COMMENT ON COLUMN public.channel_submissions.access_key_hash IS
  'SHA-256 da chave de acompanhamento entregue a quem enviou sem se identificar. A chave em si não é guardada.';
COMMENT ON COLUMN public.channel_submissions.author_employee_id IS
  'Quem enviou, só quando escolheu se identificar no SIM. Vem do login, no servidor.';
