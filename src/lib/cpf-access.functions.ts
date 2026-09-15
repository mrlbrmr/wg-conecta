import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "@/integrations/supabase/admin-middleware";
import { CPF_LOGIN_DOMAIN, isValidCpf, onlyDigits } from "@/lib/cpf";
import { findAuthUserByEmail } from "@/lib/employee.functions";

/**
 * Acesso ao portal por CPF + senha, para quem não tem e-mail corporativo.
 *
 * O CPF entra aqui e sai como HMAC. Nenhuma destas funções grava, devolve ou registra em log
 * o CPF em claro. Ver `supabase/migrations/20260915130000_employee_cpf_logins.sql`.
 */

const cpfSchema = z
  .string()
  .max(20)
  .transform(onlyDigits)
  .refine(isValidCpf, "CPF inválido. Confira os 11 dígitos.");

/** HMAC-SHA256 do CPF com o segredo do servidor. Sem o segredo, não há login por CPF. */
async function cpfHmac(cpf: string): Promise<string> {
  const pepper = process.env.CPF_LOGIN_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error("Login por CPF indisponível: falta configurar CPF_LOGIN_PEPPER no servidor.");
  }
  const { createHmac } = await import("crypto");
  return createHmac("sha256", pepper).update(cpf).digest("hex");
}

/** E-mail sintético da conta no Auth. 128 bits do HMAC bastam e cabem no limite de 64. */
function loginEmail(hmac: string): string {
  return `${hmac.slice(0, 32)}@${CPF_LOGIN_DOMAIN}`;
}

const PASSWORD_WORDS = [
  "Bateria", "Carga", "Volt", "Motor", "Farol", "Estrada", "Rota", "Polo",
  "Energia", "Partida", "Frota", "Pneu", "Oficina", "Painel", "Chave", "Faisca",
];

/**
 * Senha provisória fácil de ditar e de digitar no celular: "Farol-482731".
 * Vale só até o primeiro acesso, quando a pessoa é obrigada a criar a dela.
 */
async function temporaryPassword(): Promise<string> {
  const { randomInt } = await import("crypto");
  const word = PASSWORD_WORDS[randomInt(PASSWORD_WORDS.length)];
  const digits = String(randomInt(1_000_000)).padStart(6, "0");
  return `${word}-${digits}`;
}

const CPF_APP_METADATA = { login: "cpf", must_change_password: true } as const;

/**
 * Tela de acesso: CPF → e-mail sintético, para o navegador chamar `signInWithPassword` direto
 * (e manter o limite de tentativas por IP do Supabase). Devolve o e-mail de qualquer CPF
 * válido, exista a conta ou não: a resposta não conta quem tem cadastro.
 */
export const resolveCpfLogin = createServerFn({ method: "POST" })
  .validator(z.object({ cpf: cpfSchema }))
  .handler(async ({ data }) => ({ email: loginEmail(await cpfHmac(data.cpf)) }));

/** Quem entra por CPF, com os dois últimos dígitos — para a tela de Colaboradores. */
export const listCpfLogins = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("employee_cpf_logins")
      .select("employee_id, cpf_last2");
    if (error) throw new Error(error.message);
    return (data ?? []) as { employee_id: string; cpf_last2: string }[];
  });

/**
 * Cria o acesso por CPF — ou corrige o CPF de quem já entra por CPF. Em ambos os casos gera
 * uma senha provisória, devolvida uma única vez para o G&G entregar à pessoa.
 */
export const setCpfAccess = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ employeeId: z.string().uuid(), cpf: cpfSchema }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hmac = await cpfHmac(data.cpf);
    const email = loginEmail(hmac);

    const { data: emp, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("id, name, auth_user_id, active")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (empErr) throw new Error(empErr.message);
    if (!emp) throw new Error("Colaborador não encontrado.");
    if (!emp.active) throw new Error("Colaborador inativo. Reative o cadastro antes de dar acesso.");

    const { data: taken } = await supabaseAdmin
      .from("employee_cpf_logins")
      .select("employee_id")
      .eq("cpf_hmac", hmac)
      .maybeSingle();
    if (taken && taken.employee_id !== emp.id) {
      throw new Error("Este CPF já dá acesso a outro colaborador.");
    }

    const { data: current } = await supabaseAdmin
      .from("employee_cpf_logins")
      .select("employee_id")
      .eq("employee_id", emp.id)
      .maybeSingle();
    if (emp.auth_user_id && !current) {
      throw new Error("Este colaborador já entra com e-mail. Use “Resetar senha” se ele esqueceu.");
    }

    const password = await temporaryPassword();
    let userId: string;

    if (emp.auth_user_id) {
      // Já entra por CPF: o G&G está corrigindo um CPF digitado errado.
      const { error } = await supabaseAdmin.auth.admin.updateUserById(emp.auth_user_id, {
        email,
        email_confirm: true,
        password,
        app_metadata: CPF_APP_METADATA,
      });
      if (error) throw new Error(error.message);
      userId = emp.auth_user_id;
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: CPF_APP_METADATA,
        user_metadata: { name: emp.name },
      });
      if (created?.user) {
        userId = created.user.id;
      } else {
        // A conta pode ter sobrado de um cadastro excluído do diretório (a exclusão não apaga
        // o Auth). Reaproveita — desde que não seja de outro colaborador.
        const orphan = error && /already|registered|exists/i.test(error.message)
          ? await findAuthUserByEmail(supabaseAdmin, email)
          : null;
        if (!orphan) throw new Error(error?.message ?? "Não foi possível criar o acesso.");
        const { data: owner } = await supabaseAdmin
          .from("employees")
          .select("id")
          .eq("auth_user_id", orphan.id)
          .maybeSingle();
        if (owner && owner.id !== emp.id) {
          throw new Error("Este CPF já dá acesso a outro colaborador.");
        }
        const { error: reuseErr } = await supabaseAdmin.auth.admin.updateUserById(orphan.id, {
          password,
          app_metadata: CPF_APP_METADATA,
          user_metadata: { name: emp.name },
          ban_duration: "none",
        });
        if (reuseErr) throw new Error(reuseErr.message);
        userId = orphan.id;
      }
    }

    const now = new Date().toISOString();
    const { error: loginErr } = await supabaseAdmin.from("employee_cpf_logins").upsert(
      { employee_id: emp.id, cpf_hmac: hmac, cpf_last2: data.cpf.slice(-2), updated_at: now },
      { onConflict: "employee_id" },
    );
    if (loginErr) throw new Error(loginErr.message);

    const { error: linkErr } = await supabaseAdmin
      .from("employees")
      .update({ auth_user_id: userId, invited_at: now, updated_at: now })
      .eq("id", emp.id);
    if (linkErr) throw new Error(linkErr.message);

    return { password, cpfLast2: data.cpf.slice(-2) };
  });

/** Esqueceu a senha: o G&G gera outra provisória, e a pessoa volta a ter de trocar. */
export const resetCpfPassword = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ employeeId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: emp }, { data: login }] = await Promise.all([
      supabaseAdmin.from("employees").select("auth_user_id").eq("id", data.employeeId).maybeSingle(),
      supabaseAdmin
        .from("employee_cpf_logins")
        .select("cpf_last2")
        .eq("employee_id", data.employeeId)
        .maybeSingle(),
    ]);
    if (!emp?.auth_user_id || !login) throw new Error("Este colaborador não entra por CPF.");

    const password = await temporaryPassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(emp.auth_user_id, {
      password,
      app_metadata: CPF_APP_METADATA,
    });
    if (error) throw new Error(error.message);
    return { password, cpfLast2: login.cpf_last2 as string };
  });

/**
 * Primeiro acesso com senha provisória: grava a senha nova e tira a obrigação de trocar, num
 * passo só — pelo servidor, para ninguém conseguir tirar a flag sem trocar a senha.
 */
export const finishPasswordChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ password: z.string().min(8).max(72) }))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: data.password,
      app_metadata: { must_change_password: false },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
