/**
 * Notificação por e-mail para o time de Gente & Gestão.
 *
 * O projeto não tem provedor de e-mail próprio (só os transacionais do Supabase
 * Auth). Como as server functions já rodam no servidor, basta um fetch para a
 * API do Resend — sem SDK novo.
 *
 * Os destinatários são os administradores ativos em `admin_users`: quem ganha
 * ou perde acesso ao painel entra e sai da lista sozinho, sem mexer em config.
 *
 * Env vars (configuradas na Vercel):
 *   RESEND_API_KEY — chave da API do Resend
 *   GG_NOTIFY_FROM — remetente, ex.: "Portal WG <portal@wgbaterias.com.br>"
 *                    (o domínio precisa estar verificado no Resend)
 *
 * Sem elas a função é um no-op: o portal continua funcionando, apenas sem e-mail.
 */

/** E-mails dos administradores ativos, sem repetição. */
export async function resolveGgRecipients(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("email")
    .eq("active", true);
  if (error) throw new Error(error.message);
  const emails = (data ?? []).map((a) => a.email?.trim()).filter((e): e is string => !!e);
  return Array.from(new Set(emails));
}

export async function notifyGG(subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.GG_NOTIFY_FROM;
  if (!key || !from) return false;

  const to = await resolveGgRecipients();
  if (to.length === 0) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return true;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
