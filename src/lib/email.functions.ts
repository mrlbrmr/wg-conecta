import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, type AdminIdentity } from "@/integrations/supabase/admin-middleware";

/**
 * E-mails disparados pelo painel: o aviso de comunicado novo e o e-mail de teste de
 * Configurações. Os avisos de solicitação e de pedido cadastral ficam junto das ações que os
 * disparam (`request.functions.ts`, `profile-request.functions.ts`).
 */

/** Hoje em Brasília, "aaaa-mm-dd" — o mesmo formato de `published_at` no formulário. */
function todayBR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Avisa todos os colaboradores ativos com e-mail de que saiu um comunicado.
 *
 * Só dispara uma vez por comunicado: a marcação `email_sent_at` é gravada antes do envio, com
 * `WHERE email_sent_at IS NULL`, então dois cliques ou dois salvamentos não repetem o aviso.
 * Rascunho, arquivado e publicação com data futura não disparam.
 */
export const notifyAnnouncementPublished = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }): Promise<{ sent: number; reason?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const notify = await import("@/lib/notify.server");

    const { data: row, error } = await supabaseAdmin
      .from("announcements")
      .select("id, title, summary, status, published_at, email_sent_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.status !== "publicado" || row.email_sent_at) return { sent: 0 };
    if (row.published_at && row.published_at.slice(0, 10) > todayBR()) {
      return { sent: 0, reason: "publicação agendada" };
    }
    if (!(await notify.employeeEmailsEnabled())) {
      return { sent: 0, reason: "e-mails desligados em Configurações" };
    }
    const missing = notify.missingEmailConfig();
    if (missing) return { sent: 0, reason: missing };

    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("announcements")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("email_sent_at", null)
      .select("id");
    if (claimError) throw new Error(claimError.message);
    if (!claimed || claimed.length === 0) return { sent: 0 };

    const { data: people, error: peopleError } = await supabaseAdmin
      .from("employees")
      .select("email")
      .eq("active", true)
      .not("email", "is", null);
    if (peopleError) throw new Error(peopleError.message);
    const to = (people ?? [])
      .map((p) => notify.deliverableEmail(p.email))
      .filter((e): e is string => !!e);

    try {
      const sent = await notify.sendEmailToEach(
        to,
        `Comunicado: ${row.title}`,
        notify.emailLayout({
          title: row.title,
          body: row.summary ? `<p>${notify.escapeHtml(row.summary)}</p>` : "<p>Saiu um comunicado novo no mural.</p>",
          cta: "Ler no portal",
          href: `${notify.SITE_URL}/mural/${row.id}`,
        }),
      );
      return { sent };
    } catch (e) {
      // Falhou antes de entregar a todos: libera a marcação para dar para tentar de novo.
      await supabaseAdmin.from("announcements").update({ email_sent_at: null }).eq("id", row.id);
      throw e;
    }
  });

/** E-mail de teste para o próprio admin. Devolve o motivo exato quando não dá certo. */
export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async ({ context }): Promise<{ ok: boolean; message: string }> => {
    const { admin } = context as { admin: AdminIdentity };
    const notify = await import("@/lib/notify.server");

    const missing = notify.missingEmailConfig();
    if (missing) return { ok: false, message: missing };
    if (!admin.email) return { ok: false, message: "Seu usuário admin não tem e-mail cadastrado." };

    const recipients = await notify.resolveGgRecipients();
    try {
      await notify.sendEmail(
        [admin.email],
        "Teste de e-mail do Portal WG",
        notify.emailLayout({
          title: "O envio de e-mails está funcionando",
          body:
            `<p>Este é um teste disparado em Configurações.</p>` +
            `<p>Avisos do G&amp;G vão para ${recipients.length} admin(s) ativo(s).</p>`,
          cta: "Abrir o painel",
          href: `${notify.SITE_URL}/admin/configuracoes`,
        }),
      );
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
    return {
      ok: true,
      message: `Enviado para ${admin.email}. Confira a caixa de entrada e o spam.`,
    };
  });
