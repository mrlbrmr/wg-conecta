import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-middleware";
import type { Json } from "@/integrations/supabase/types";

/**
 * A fila de solicitações do painel.
 *
 * Estas rodam com service role sob `requireAdmin` — o RLS de `requests` já
 * liberaria o admin, mas o painel precisa do join com `employees`, que o
 * colaborador não enxerga.
 */

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const REQUEST_STATUSES = ["em_analise", "respondida", "concluida"] as const;
export type PortalRequestStatus = (typeof REQUEST_STATUSES)[number];

const STATUS_TEXT: Record<PortalRequestStatus, string> = {
  em_analise: "voltou para análise",
  respondida: "recebeu uma resposta",
  concluida: "foi concluída",
};

/**
 * Aviso ao colaborador de que a solicitação andou. Só protocolo, título e status — a
 * conversa fica no portal. Nunca derruba a ação do G&G.
 */
async function notifyRequester(requestId: string, status: PortalRequestStatus) {
  try {
    const supabase = await db();
    const { data: request } = await supabase
      .from("requests")
      .select("id, protocol, title, employee_id")
      .eq("id", requestId)
      .maybeSingle();
    if (!request?.employee_id) return;
    const { notifyEmployee, emailLayout, escapeHtml, SITE_URL } = await import(
      "@/lib/notify.server"
    );
    await notifyEmployee(
      request.employee_id,
      `Sua solicitação ${request.protocol} ${STATUS_TEXT[status]}`,
      emailLayout({
        title: `Sua solicitação ${STATUS_TEXT[status]}`,
        body:
          `<p><strong>${escapeHtml(request.title)}</strong> — protocolo ${request.protocol}.</p>` +
          `<p>Os detalhes estão no portal.</p>`,
        cta: "Ver solicitação",
        href: `${SITE_URL}/solicitacoes/${request.id}`,
      }),
    );
  } catch (e) {
    console.error("[request] aviso por e-mail ao colaborador falhou", e);
  }
}

export interface AdminRequest {
  id: string;
  protocol: number;
  title: string;
  subject: string | null;
  body: string | null;
  status: string;
  priority: string | null;
  payload: Json;
  attachment_path: string | null;
  due_date: string | null;
  created_at: string;
  form_slug: string | null;
  employee: {
    id: string;
    name: string;
    department: string | null;
    job_title: string | null;
    photo_url: string | null;
  } | null;
}

export interface RequestMessage {
  id: string;
  body: string;
  created_at: string;
  author_id: string | null;
  author_name: string | null;
}

const REQUEST_COLUMNS =
  "id, protocol, title, subject, body, status, priority, payload, attachment_path, due_date, created_at, employee_id, form_id";

export const listRequests = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async (): Promise<AdminRequest[]> => {
    const supabase = await db();

    const { data, error } = await supabase
      .from("requests")
      .select(REQUEST_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as Array<
      Record<string, unknown> & { employee_id: string; form_id: string | null }
    >;
    if (rows.length === 0) return [];

    // Join manual: `requests` não declara relacionamento no PostgREST, e são
    // duas consultas curtas contra listas pequenas.
    const employeeIds = Array.from(new Set(rows.map((r) => r.employee_id)));
    const formIds = Array.from(
      new Set(rows.map((r) => r.form_id).filter((v): v is string => Boolean(v))),
    );

    const [{ data: employees }, { data: forms }] = await Promise.all([
      supabase
        .from("employees")
        .select("id, name, department, job_title, photo_url")
        .in("id", employeeIds),
      formIds.length
        ? supabase.from("forms").select("id, slug").in("id", formIds)
        : Promise.resolve({ data: [] as Array<{ id: string; slug: string | null }> }),
    ]);

    const byEmployee = new Map((employees ?? []).map((e) => [e.id, e]));
    const bySlug = new Map((forms ?? []).map((f) => [f.id, f.slug]));

    return rows.map((r) => ({
      id: r.id as string,
      protocol: r.protocol as number,
      title: r.title as string,
      subject: (r.subject as string | null) ?? null,
      body: (r.body as string | null) ?? null,
      status: r.status as string,
      priority: (r.priority as string | null) ?? null,
      payload: (r.payload as Json) ?? {},
      attachment_path: (r.attachment_path as string | null) ?? null,
      due_date: (r.due_date as string | null) ?? null,
      created_at: r.created_at as string,
      form_slug: r.form_id ? (bySlug.get(r.form_id) ?? null) : null,
      employee: byEmployee.get(r.employee_id) ?? null,
    }));
  });

export const listRequestMessages = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ request_id: z.string().uuid() }))
  .handler(async ({ data }): Promise<RequestMessage[]> => {
    const supabase = await db();
    const { data: rows, error } = await supabase
      .from("request_messages")
      .select("id, body, created_at, author_id")
      .eq("request_id", data.request_id)
      .order("created_at");
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    const authorIds = Array.from(
      new Set(list.map((m) => m.author_id).filter((v): v is string => Boolean(v))),
    );
    const { data: authors } = authorIds.length
      ? await supabase.from("employees").select("id, name").in("id", authorIds)
      : { data: [] as Array<{ id: string; name: string }> };
    const byId = new Map((authors ?? []).map((a) => [a.id, a.name]));

    return list.map((m) => ({
      id: m.id,
      body: m.body,
      created_at: m.created_at,
      author_id: m.author_id,
      author_name: m.author_id ? (byId.get(m.author_id) ?? null) : null,
    }));
  });

/**
 * Resposta do G&G. Grava na conversa e move a solicitação para "respondida" —
 * são as duas metades da mesma ação, então ficam na mesma função.
 */
export const replyToRequest = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ request_id: z.string().uuid(), body: z.string().trim().min(1).max(4000) }))
  .handler(async ({ data, context }) => {
    const supabase = await db();
    const { admin } = context as { admin: { id: string; name: string } };

    // O admin pode não ter cadastro de colaborador; `author_id` aceita nulo e a
    // tela mostra "Gente & Gestão" nesse caso.
    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", admin.id)
      .maybeSingle();

    const { error: msgError } = await supabase.from("request_messages").insert({
      request_id: data.request_id,
      author_id: employee?.id ?? null,
      body: data.body.trim(),
    });
    if (msgError) throw new Error(msgError.message);

    // Uma solicitação já concluída não volta a "respondida" só por um recado.
    const { error } = await supabase
      .from("requests")
      .update({ status: "respondida" })
      .eq("id", data.request_id)
      .eq("status", "em_analise");
    if (error) throw new Error(error.message);

    // Todo recado do G&G avisa, mesmo em solicitação já concluída.
    await notifyRequester(data.request_id, "respondida");
    return { ok: true };
  });

export const setRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ request_id: z.string().uuid(), status: z.enum(REQUEST_STATUSES) }))
  .handler(async ({ data }) => {
    const supabase = await db();
    // Só avisa se o status mudou de fato: escolher o mesmo status de novo não gera e-mail.
    const { data: changed, error } = await supabase
      .from("requests")
      .update({ status: data.status })
      .eq("id", data.request_id)
      .neq("status", data.status)
      .select("id");
    if (error) throw new Error(error.message);
    if (changed && changed.length > 0) await notifyRequester(data.request_id, data.status);
    return { ok: true };
  });

/** URL assinada do anexo, para o G&G abrir da fila. */
export const adminAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ path: z.string().min(1).max(400) }))
  .handler(async ({ data }) => {
    const supabase = await db();
    const { data: signed, error } = await supabase.storage
      .from("request-attachments")
      .createSignedUrl(data.path, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
