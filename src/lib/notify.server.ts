/**
 * Notificação por e-mail — para o time de Gente & Gestão e para os colaboradores.
 *
 * O projeto não tem provedor de e-mail próprio (só os transacionais do Supabase
 * Auth). Como as server functions já rodam no servidor, basta um fetch para a
 * API do Resend — sem SDK novo.
 *
 * Os destinatários do G&G são os administradores ativos em `admin_users`: quem ganha
 * ou perde acesso ao painel entra e sai da lista sozinho, sem mexer em config.
 *
 * Env vars (configuradas na Vercel):
 *   RESEND_API_KEY — chave da API do Resend
 *   GG_NOTIFY_FROM — remetente, ex.: "Portal WG <portal@wgbaterias.com.br>"
 *                    (o domínio precisa estar verificado no Resend)
 *
 * Sem elas nada é enviado: o portal continua funcionando, e o log da Vercel avisa.
 * Os logs daqui nunca levam assunto, conteúdo nem destinatário.
 *
 * E-mails a colaboradores respeitam `portal_settings.employee_emails_enabled` e pulam
 * quem não tem caixa postal (sem e-mail ou com o e-mail sintético do login por CPF).
 */

import { isCpfLoginEmail } from "@/lib/cpf";
import { normalizeSiteUrl } from "@/lib/site-url";

export const SITE_URL = normalizeSiteUrl(process.env.SITE_URL);

const RESEND_URL = "https://api.resend.com";
/** Limite do endpoint de lote do Resend. */
const BATCH_SIZE = 100;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** O que falta para enviar, ou `null` se está tudo configurado. */
export function missingEmailConfig(): string | null {
  const missing = ["RESEND_API_KEY", "GG_NOTIFY_FROM"].filter((k) => !process.env[k]);
  return missing.length ? `Faltam as variáveis ${missing.join(" e ")} na Vercel.` : null;
}

function config(): { key: string; from: string } | null {
  const missing = missingEmailConfig();
  if (missing) {
    console.warn(`[email] envio ignorado: ${missing}`);
    return null;
  }
  return { key: process.env.RESEND_API_KEY!, from: process.env.GG_NOTIFY_FROM! };
}

async function resend(path: string, body: unknown, key: string): Promise<void> {
  const res = await fetch(`${RESEND_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error(`[email] Resend respondeu ${res.status}`);
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
}

/** E-mails dos administradores ativos, sem repetição. */
export async function resolveGgRecipients(): Promise<string[]> {
  const db = await admin();
  const { data, error } = await db.from("admin_users").select("email").eq("active", true);
  if (error) throw new Error(error.message);
  const emails = (data ?? []).map((a) => a.email?.trim()).filter((e): e is string => !!e);
  if (emails.length === 0) console.warn("[email] nenhum admin ativo com e-mail em admin_users");
  return Array.from(new Set(emails));
}

export async function notifyGG(subject: string, html: string): Promise<boolean> {
  if (!config()) return false;
  return sendEmail(await resolveGgRecipients(), subject, html);
}

/** E-mail avulso pelo mesmo remetente. Sem env ou sem destinatário, não faz nada. */
export async function sendEmail(to: string[], subject: string, html: string): Promise<boolean> {
  const cfg = config();
  if (!cfg || to.length === 0) return false;
  await resend("/emails", { from: cfg.from, to, subject, html }, cfg.key);
  return true;
}

/** O mesmo e-mail para cada pessoa, um envio por destinatário (ninguém vê a lista). */
export async function sendEmailToEach(to: string[], subject: string, html: string): Promise<number> {
  const cfg = config();
  if (!cfg) return 0;
  const unique = Array.from(new Set(to));
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique
      .slice(i, i + BATCH_SIZE)
      .map((email) => ({ from: cfg.from, to: [email], subject, html }));
    await resend("/emails/batch", batch, cfg.key);
  }
  return unique.length;
}

/** Caixa postal de verdade: descarta vazio e o e-mail sintético do login por CPF. */
export function deliverableEmail(email: string | null | undefined): string | null {
  const value = email?.trim();
  return value && !isCpfLoginEmail(value) ? value : null;
}

/** Interruptor do painel (Configurações). Sem a coluna ainda, vale ligado. */
export async function employeeEmailsEnabled(): Promise<boolean> {
  const db = await admin();
  const { data } = await db.from("portal_settings").select("*").eq("singleton", true).maybeSingle();
  return (data as { employee_emails_enabled?: boolean } | null)?.employee_emails_enabled !== false;
}

/** Aviso a um colaborador. Não envia se o interruptor estiver desligado ou se não houver caixa. */
export async function notifyEmployee(
  employeeId: string,
  subject: string,
  html: string,
): Promise<boolean> {
  if (!(await employeeEmailsEnabled())) return false;
  const db = await admin();
  const { data } = await db
    .from("employees")
    .select("email, active")
    .eq("id", employeeId)
    .maybeSingle();
  const email = data?.active ? deliverableEmail(data.email) : null;
  if (!email) return false;
  return sendEmail([email], subject, html);
}

/** Molde comum dos avisos: título, texto e um botão para o portal. */
export function emailLayout({
  title,
  body,
  cta,
  href,
}: {
  title: string;
  body: string;
  cta: string;
  href: string;
}): string {
  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;color:#161616">` +
    `<p style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#666">Portal WG</p>` +
    `<h1 style="font-size:22px;margin:0 0 12px">${escapeHtml(title)}</h1>` +
    `<div style="font-size:15px;line-height:1.6">${body}</div>` +
    `<p style="margin:24px 0"><a href="${href}" style="display:inline-block;background:#161616;color:#fff;` +
    `padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">${escapeHtml(cta)}</a></p>` +
    `<p style="font-size:12px;color:#666">Aviso automático do Portal do Colaborador. Não responda este e-mail.</p>` +
    `</div>`
  );
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
