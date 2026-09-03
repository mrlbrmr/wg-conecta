import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  FORM_META,
  REQUEST_FORM_SLUGS,
  priorityOf,
  renderPayload,
  schemaFor,
  titleFor,
  type RequestFormSlug,
} from "@/lib/form-defs";
import { normalizeSiteUrl } from "@/lib/site-url";
import type { Json } from "@/integrations/supabase/types";

const SITE_URL = normalizeSiteUrl(process.env.SITE_URL);

/**
 * Escritas do colaborador no portal.
 *
 * Todas passam por `requireSupabaseAuth` e resolvem o colaborador a partir do
 * JWT — o cliente nunca escolhe em nome de quem grava. As policies de RLS
 * repetem a mesma regra no banco (`app_private.current_employee_id()`), então
 * uma falha aqui não abre a porta lá.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Colaborador do usuário autenticado — por auth_user_id, com fallback para id. */
async function employeeIdOf(userId: string): Promise<string> {
  const db = await admin();
  const { data } = await db.from("employees").select("id").eq("auth_user_id", userId).maybeSingle();
  if (data?.id) return data.id;

  const { data: byId } = await db.from("employees").select("id").eq("id", userId).maybeSingle();
  if (byId?.id) return byId.id;

  throw new Error("Não encontramos seu cadastro de colaborador. Fala com o G&G?");
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

// ── Perfil ────────────────────────────────────────────────────────────

export const updateOwnBio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ bio: z.string().max(1000) }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const id = await employeeIdOf((context as { userId: string }).userId);
    fail(
      (
        await db
          .from("employees")
          .update({ bio: data.bio.trim() || null })
          .eq("id", id)
      ).error,
    );
    return { ok: true };
  });

export const updateOwnContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ extension: z.string().max(20).nullish() }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const id = await employeeIdOf((context as { userId: string }).userId);
    const extension = data.extension?.trim() || null;
    fail((await db.from("employees").update({ extension }).eq("id", id)).error);
    return { ok: true };
  });

export const updateOwnPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ photo_url: z.string().min(1).max(500) }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const id = await employeeIdOf((context as { userId: string }).userId);
    fail((await db.from("employees").update({ photo_url: data.photo_url }).eq("id", id)).error);
    return { ok: true };
  });

// ── Cultura ───────────────────────────────────────────────────────────

export const publishRecognition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      to_employee_id: z.string().uuid(),
      message: z.string().min(3).max(600),
    }),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const from = await employeeIdOf((context as { userId: string }).userId);
    if (from === data.to_employee_id) throw new Error("Reconhecimento é para os outros.");

    const insert = {
      to_employee_id: data.to_employee_id,
      from_employee_id: from,
      message: data.message.trim(),
    };
    fail((await db.from("peer_recognitions").insert(insert)).error);
    return { ok: true };
  });

/** Parabéns pelo aniversário de casa — um por pessoa, por ano. Alterna. */
export const toggleCongrats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ to_employee_id: z.string().uuid(), year: z.number().int() }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const from = await employeeIdOf((context as { userId: string }).userId);

    const { data: existing } = await db
      .from("anniversary_congrats")
      .select("id")
      .eq("from_employee_id", from)
      .eq("to_employee_id", data.to_employee_id)
      .eq("year", data.year)
      .maybeSingle();

    if (existing) {
      fail((await db.from("anniversary_congrats").delete().eq("id", existing.id)).error);
      return { ok: true, congratulated: false };
    }

    const insert = {
      from_employee_id: from,
      to_employee_id: data.to_employee_id,
      year: data.year,
    };
    fail((await db.from("anniversary_congrats").insert(insert)).error);
    return { ok: true, congratulated: true };
  });

// ── Mural ─────────────────────────────────────────────────────────────

export const setAnnouncementRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ announcement_id: z.string().uuid(), read: z.boolean() }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const employee_id = await employeeIdOf((context as { userId: string }).userId);

    if (!data.read) {
      const del = await db
        .from("announcement_reads")
        .delete()
        .eq("announcement_id", data.announcement_id)
        .eq("employee_id", employee_id);
      fail(del.error);
      return { ok: true, read: false };
    }

    const up = await db
      .from("announcement_reads")
      .upsert(
        { announcement_id: data.announcement_id, employee_id },
        { onConflict: "announcement_id,employee_id" },
      );
    fail(up.error);
    return { ok: true, read: true };
  });

const REACTIONS = ["curti", "importante", "obrigado", "parabens"] as const;

/** Uma reação por pessoa: escolher outra move o voto, repetir a mesma remove. */
export const setAnnouncementReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({ announcement_id: z.string().uuid(), reaction: z.enum(REACTIONS).nullable() }),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const employee_id = await employeeIdOf((context as { userId: string }).userId);

    if (data.reaction === null) {
      const del = await db
        .from("announcement_reactions")
        .delete()
        .eq("announcement_id", data.announcement_id)
        .eq("employee_id", employee_id);
      fail(del.error);
      return { ok: true, reaction: null };
    }

    const up = await db
      .from("announcement_reactions")
      .upsert(
        { announcement_id: data.announcement_id, employee_id, reaction: data.reaction },
        { onConflict: "announcement_id,employee_id" },
      );
    fail(up.error);
    return { ok: true, reaction: data.reaction };
  });

export const postComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ announcement_id: z.string().uuid(), body: z.string().min(1).max(2000) }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const author_id = await employeeIdOf((context as { userId: string }).userId);

    const insert = {
      announcement_id: data.announcement_id,
      author_id,
      body: data.body.trim(),
    };
    fail((await db.from("announcement_comments").insert(insert)).error);
    return { ok: true };
  });

// ── Integração ────────────────────────────────────────────────────────

export const setChecklistItemDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ item_id: z.string().uuid(), done: z.boolean() }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const employee_id = await employeeIdOf((context as { userId: string }).userId);

    if (!data.done) {
      const del = await db
        .from("onboarding_progress")
        .delete()
        .eq("item_id", data.item_id)
        .eq("employee_id", employee_id);
      fail(del.error);
      return { ok: true, done: false };
    }

    const up = await db
      .from("onboarding_progress")
      .upsert({ item_id: data.item_id, employee_id }, { onConflict: "employee_id,item_id" });
    fail(up.error);
    return { ok: true, done: true };
  });

export const setMaterialViewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ material_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const employee_id = await employeeIdOf((context as { userId: string }).userId);

    const up = await db
      .from("material_views")
      .upsert(
        { material_id: data.material_id, employee_id },
        { onConflict: "employee_id,material_id" },
      );
    fail(up.error);
    return { ok: true };
  });

// ── Solicitações ──────────────────────────────────────────────────────

/** Dias úteis a partir de hoje — o prazo combinado de cada formulário. */
function businessDaysFromNow(days: number): string {
  const d = new Date();
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const weekday = d.getDay();
    if (weekday !== 0 && weekday !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}

export const openRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      form_id: z.string().uuid().nullish(),
      title: z.string().min(3).max(160),
      subject: z.string().max(80).nullish(),
      body: z.string().max(4000).nullish(),
    }),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const employee_id = await employeeIdOf((context as { userId: string }).userId);

    let sla = 3;
    let subject = data.subject ?? null;
    if (data.form_id) {
      const { data: form } = await db
        .from("forms")
        .select("sla_days, category")
        .eq("id", data.form_id)
        .maybeSingle();
      if (form) {
        sla = form.sla_days ?? 3;
        subject = subject ?? form.category;
      }
    }

    const { data: created, error } = await db
      .from("requests")
      .insert({
        employee_id,
        form_id: data.form_id ?? null,
        title: data.title.trim(),
        subject,
        body: data.body?.trim() || null,
        due_date: businessDaysFromNow(sla),
      })
      .select("id, protocol")
      .single();
    fail(error);
    return { ok: true, id: created!.id, protocol: created!.protocol };
  });

/**
 * Envio de um formulário interno (Férias, Solicitação Geral).
 *
 * O `payload` chega solto e é revalidado aqui com o mesmo schema zod que a tela
 * usou — a validação do cliente é conveniência, esta é a que vale. Título,
 * assunto, prazo e prioridade são todos derivados no servidor: o cliente não
 * escolhe nada disso.
 *
 * A Atualização Cadastral não passa por aqui — ela tem fluxo próprio, com diff e
 * aprovação que aplica no cadastro (`createProfileUpdateRequest`).
 */
export const openFormRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      slug: z.enum(REQUEST_FORM_SLUGS),
      payload: z.record(z.unknown()),
      attachment_path: z.string().max(400).nullish(),
    }),
  )
  .handler(async ({ data, context }) => {
    const slug = data.slug as RequestFormSlug;
    const parsed = schemaFor(slug).safeParse(data.payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new Error(first?.message ?? "Confere os campos do formulário?");
    }
    const payload = parsed.data as Record<string, unknown>;

    const db = await admin();
    const employee_id = await employeeIdOf((context as { userId: string }).userId);

    // O anexo já foi enviado para a pasta do próprio colaborador (a policy de
    // storage garante isso). Aqui só recusamos um caminho de outra pessoa.
    const attachment = data.attachment_path?.trim() || null;
    if (attachment && !attachment.startsWith(`${employee_id}/`)) {
      throw new Error("Anexo inválido.");
    }

    const { data: form } = await db
      .from("forms")
      .select("id, sla_days, category")
      .eq("slug", slug)
      .maybeSingle();

    const meta = FORM_META[slug];
    const sla = form?.sla_days ?? 3;

    const { data: created, error } = await db
      .from("requests")
      .insert({
        employee_id,
        form_id: form?.id ?? null,
        title: titleFor(slug, payload),
        subject: form?.category ?? meta.category,
        body: typeof payload.description === "string" ? payload.description : null,
        payload: payload as Json,
        priority: priorityOf(slug, payload),
        attachment_path: attachment,
        due_date: businessDaysFromNow(sla),
      })
      .select("id, protocol")
      .single();
    fail(error);

    // A notificação nunca derruba a criação da solicitação.
    try {
      const { notifyGG, escapeHtml } = await import("@/lib/notify.server");
      const rows = renderPayload(slug, payload)
        .map(
          (e) =>
            `<tr><td><strong>${escapeHtml(e.label)}</strong></td><td>${escapeHtml(e.value)}</td></tr>`,
        )
        .join("");
      await notifyGG(
        `${meta.title} — protocolo ${created!.protocol}`,
        `<p>Nova solicitação pelo portal.</p><table>${rows}</table>` +
          (attachment ? `<p>A solicitação tem anexo.</p>` : "") +
          `<p><a href="${SITE_URL}/admin/solicitacoes">Abrir no painel</a></p>`,
      );
    } catch (e) {
      console.error("[open-form-request] notificação por e-mail falhou", e);
    }

    return { ok: true, id: created!.id, protocol: created!.protocol };
  });

/**
 * URL assinada do anexo, válida por poucos minutos.
 *
 * O bucket é privado e o proxy `/api/public/files` não pede login, então a
 * leitura passa por aqui: quem pode ver é o dono da solicitação ou o G&G.
 */
export const getRequestAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ request_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const userId = (context as { userId: string }).userId;

    const { data: req } = await db
      .from("requests")
      .select("employee_id, attachment_path")
      .eq("id", data.request_id)
      .maybeSingle();
    if (!req?.attachment_path) throw new Error("Essa solicitação não tem anexo.");

    const { data: isAdmin } = await db
      .from("admin_users")
      .select("id")
      .eq("id", userId)
      .eq("active", true)
      .maybeSingle();

    if (!isAdmin) {
      const employee_id = await employeeIdOf(userId);
      if (req.employee_id !== employee_id) throw new Error("Anexo não encontrado.");
    }

    const { data: signed, error } = await db.storage
      .from("request-attachments")
      .createSignedUrl(req.attachment_path, 300);
    fail(error);

    return { url: signed!.signedUrl, name: req.attachment_path.split("/").pop() ?? "anexo" };
  });

export const postRequestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ request_id: z.string().uuid(), body: z.string().min(1).max(4000) }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const author_id = await employeeIdOf((context as { userId: string }).userId);

    // A conversa é da própria solicitação — confere antes de gravar.
    const { data: req } = await db
      .from("requests")
      .select("id")
      .eq("id", data.request_id)
      .eq("employee_id", author_id)
      .maybeSingle();
    if (!req) throw new Error("Solicitação não encontrada.");

    const insert = { request_id: data.request_id, author_id, body: data.body.trim() };
    fail((await db.from("request_messages").insert(insert)).error);
    return { ok: true };
  });
