-- Login por CPF
--
-- Motoristas, auxiliares de logística e operadores não têm e-mail corporativo. Eles passam a
-- entrar no portal com CPF e senha. O G&G cria o acesso no painel com uma senha provisória, e a
-- pessoa troca no primeiro acesso.
--
-- O CPF não é gravado. Esta tabela guarda um HMAC-SHA256 dele, feito com o segredo
-- `CPF_LOGIN_PEPPER` (variável de ambiente do servidor, fora do banco), e os dois últimos
-- dígitos, para o G&G reconhecer o cadastro. Sem o segredo, o HMAC não serve para descobrir CPF.
-- A conta no Auth usa um e-mail sintético `<hmac>@cpf.wgbaterias.com.br`, sem caixa postal.
--
-- Só o servidor (service role) lê e escreve aqui: RLS ligada, nenhuma policy, e nenhum GRANT
-- para `anon`/`authenticated`.

CREATE TABLE IF NOT EXISTS public.employee_cpf_logins (
  employee_id UUID PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  cpf_hmac    TEXT NOT NULL UNIQUE,
  cpf_last2   CHAR(2) NOT NULL CHECK (cpf_last2 ~ '^[0-9]{2}$'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_cpf_logins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.employee_cpf_logins FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.employee_cpf_logins TO service_role;

COMMENT ON TABLE public.employee_cpf_logins IS
  'Quem entra no portal por CPF. Guarda só o HMAC do CPF (segredo CPF_LOGIN_PEPPER, fora do banco) e os dois últimos dígitos. Acesso só pelo servidor.';
