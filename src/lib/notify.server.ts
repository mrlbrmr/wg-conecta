/**
 * Notificação por e-mail para o time de Gente & Gestão.
 *
 * O projeto não tem provedor de e-mail próprio (só os transacionais do Supabase
 * Auth). Como as server functions já rodam no servidor, basta um fetch para a
 * API do Resend — sem SDK novo.
 *
 * Env vars (configuradas na Vercel):
 *   RESEND_API_KEY   — chave da API do Resend
 *   GG_NOTIFY_EMAILS — destinatários separados por vírgula
 *   GG_NOTIFY_FROM   — remetente, ex.: "Portal WG <portal@wgbaterias.com.br>"
 *
 * Sem elas a função é um no-op: o portal continua funcionando, apenas sem e-mail.
 */
export async function notifyGG(subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.GG_NOTIFY_FROM;
  const to = (process.env.GG_NOTIFY_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!key || !from || to.length === 0) return false;

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
