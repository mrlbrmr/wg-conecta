-- Canal de Escuta e SIM (Sistema Interno de Melhorias)
--
-- Dois canais em que quem escreve pode não se identificar:
-- - Canal de Escuta: relatos de assédio, discriminação, conduta antiética, segurança. A Lei
--   14.457/2022 pede às empresas com CIPA um canal de denúncias de assédio com anonimato.
-- - SIM: sugestões de melhoria de processo e estrutura (antes um Google Forms).
--
-- `requests` não serve: exige `employee_id` e amarra RLS, anexo e conversa à identidade. Aqui a
-- regra é o contrário — **nada que ligue a linha a quem escreveu**:
-- - nenhuma coluna de autor (nem employee_id, nem auth uid, nem IP);
-- - só a data do envio, sem hora (`received_on`), para dificultar cruzar com quem estava online;
-- - `updated_at` nasce vazio e só muda quando o G&G mexe;
-- - nada de trigger de auditoria nesta tabela.
-- Nome e contato só existem se a pessoa digitar, dentro do `payload`.
--
-- Quem enviou acompanha com protocolo + chave, entregues só a ela. A chave fica em hash.
--
-- Acesso só pelo servidor (service role): RLS ligada, nenhuma policy, nenhum GRANT para
-- `anon`/`authenticated`. O painel lê por server functions com `requireAdmin`.

CREATE TABLE IF NOT EXISTS public.anonymous_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel         TEXT NOT NULL CHECK (channel IN ('escuta', 'sim')),
  protocol        TEXT NOT NULL UNIQUE,
  access_key_hash TEXT NOT NULL,
  category        TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'recebido'
                  CHECK (status IN ('recebido', 'em_analise', 'concluido')),
  received_on     DATE NOT NULL,
  updated_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS anonymous_submissions_channel_idx
  ON public.anonymous_submissions (channel, received_on DESC);

-- A conversa também sem hora: `seq` dá a ordem, `sent_on` só o dia.
CREATE TABLE IF NOT EXISTS public.anonymous_submission_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq           BIGINT GENERATED ALWAYS AS IDENTITY,
  submission_id UUID NOT NULL REFERENCES public.anonymous_submissions(id) ON DELETE CASCADE,
  from_gg       BOOLEAN NOT NULL,
  body          TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  sent_on       DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS anonymous_submission_messages_submission_idx
  ON public.anonymous_submission_messages (submission_id, seq);

ALTER TABLE public.anonymous_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_submission_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.anonymous_submissions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.anonymous_submission_messages FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.anonymous_submissions TO service_role;
GRANT ALL ON public.anonymous_submission_messages TO service_role;

COMMENT ON TABLE public.anonymous_submissions IS
  'Canal de Escuta e SIM. Sem coluna de autor e sem hora do envio, de propósito. Acesso só pelo servidor.';
COMMENT ON COLUMN public.anonymous_submissions.access_key_hash IS
  'SHA-256 da chave de acompanhamento entregue a quem enviou. A chave em si não é guardada.';
