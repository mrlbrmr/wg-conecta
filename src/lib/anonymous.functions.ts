import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "@/integrations/supabase/admin-middleware";
import {
  CHANNEL_META,
  CHANNEL_OF_PREFIX,
  CHANNELS,
  SUBMISSION_STATUSES,
  categoryOf,
  normalizeAccessKey,
  normalizeProtocol,
  schemaForChannel,
  type Channel,
  type SubmissionStatus,
} from "@/lib/anonymous-defs";
import { normalizeSiteUrl } from "@/lib/site-url";
import type { Json } from "@/integrations/supabase/types";

const SITE_URL = normalizeSiteUrl(process.env.SITE_URL);

/**
 * Canal de Escuta e SIM.
 *
 * Regra da casa aqui: **nada que ligue um envio a quem escreveu**. O envio exige login (é canal
 * interno), mas o id do usuário serve só para conferir que é colaborador ativo — não é gravado,
 * não vai para log, não vai no e-mail. Nenhum `console.*` com conteúdo de envio neste arquivo.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Colaborador ativo? A resposta é só sim/não — o id não sai daqui. */
async function assertActiveEmployee(userId: string): Promise<void> {
  const db = await admin();
  const { data } = await db
    .from("employees")
    .select("id")
    .or(`auth_user_id.eq.${userId},id.eq.${userId}`)
    .eq("active", true)
    .limit(1);
  if (!data?.length) throw new Error("Não encontramos seu cadastro de colaborador. Fala com o G&G?");
}

/** Dia de hoje em Brasília, "aaaa-mm-dd". Sem hora, de propósito. */
function todayBR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Sem 0/O, 1/I/L: protocolo e chave são ditados e digitados no celular. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

async function randomCode(length: number): Promise<string> {
  const { randomInt } = await import("crypto");
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

async function sha256(value: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(value).digest("hex");
}

async function sameHash(a: string, b: string): Promise<boolean> {
  const { timingSafeEqual } = await import("crypto");
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Aviso ao G&G: canal e protocolo, nunca o conteúdo (e-mail fica em caixa de terceiros). */
async function notify(channel: Channel, subject: string, text: string) {
  try {
    const { notifyGG } = await import("@/lib/notify.server");
    await notifyGG(
      `${CHANNEL_META[channel].short} — ${subject}`,
      `<p>${text}</p><p>Por sigilo, o conteúdo fica só no painel.</p>` +
        `<p><a href="${SITE_URL}/admin/escuta">Abrir no painel</a></p>`,
    );
  } catch {
    // A notificação nunca derruba o envio — e o erro não vai para log com dados do envio.
  }
}

// ── Colaborador ───────────────────────────────────────────────────────

export const submitAnonymous = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ channel: z.enum(CHANNELS), payload: z.record(z.unknown()) }))
  .handler(async ({ data, context }) => {
    await assertActiveEmployee((context as { userId: string }).userId);

    const parsed = schemaForChannel(data.channel).safeParse(data.payload);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Confere os campos do formulário?");
    }
    const payload = parsed.data as Record<string, unknown>;

    const db = await admin();
    const key = `${await randomCode(4)}-${await randomCode(4)}`;
    const accessKeyHash = await sha256(key);

    // Protocolo aleatório (não sequencial: a sequência diria quantos relatos existem e em que
    // ordem chegaram). Colisão é improvável; se acontecer, tenta de novo.
    for (let attempt = 0; attempt < 5; attempt++) {
      const protocol = `${CHANNEL_META[data.channel].prefix}-${await randomCode(6)}`;
      const { error } = await db.from("anonymous_submissions").insert({
        channel: data.channel,
        protocol,
        access_key_hash: accessKeyHash,
        category: categoryOf(data.channel, payload),
        payload: payload as Json,
        received_on: todayBR(),
      });
      if (!error) {
        await notify(data.channel, `novo envio ${protocol}`, `Chegou um novo envio pelo portal.`);
        return { protocol, key };
      }
      if (!/duplicate|unique/i.test(error.message)) throw new Error("Não conseguimos registrar agora. Tenta de novo em instantes?");
    }
    throw new Error("Não conseguimos registrar agora. Tenta de novo em instantes?");
  });

const followUpInput = z.object({
  protocol: z.string().max(20).transform(normalizeProtocol),
  key: z.string().max(20).transform(normalizeAccessKey),
});

const NOT_FOUND = "Protocolo ou chave não conferem. Confira os dois e tente de novo.";

/** Envio de quem tem protocolo + chave. Resposta igual para "não existe" e "chave errada". */
async function findByProtocolAndKey(protocol: string, key: string) {
  const db = await admin();
  const { data } = await db
    .from("anonymous_submissions")
    .select("id, channel, protocol, access_key_hash, category, payload, status, received_on")
    .eq("protocol", protocol)
    .maybeSingle();
  const keyHash = await sha256(key);
  if (!data || !(await sameHash(data.access_key_hash, keyHash))) throw new Error(NOT_FOUND);
  return data;
}

async function messagesOf(submissionId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("anonymous_submission_messages")
    .select("id, from_gg, body, sent_on")
    .eq("submission_id", submissionId)
    .order("seq");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const followUpAnonymous = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(followUpInput)
  .handler(async ({ data }) => {
    if (!CHANNEL_OF_PREFIX[data.protocol.slice(0, 3)]) throw new Error(NOT_FOUND);
    const row = await findByProtocolAndKey(data.protocol, data.key);
    return {
      channel: row.channel as Channel,
      protocol: row.protocol,
      category: row.category,
      status: row.status as SubmissionStatus,
      received_on: row.received_on,
      payload: row.payload as Record<string, string>,
      messages: await messagesOf(row.id),
    };
  });

export const replyAnonymous = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(followUpInput.extend({ body: z.string().trim().min(1).max(5000) }))
  .handler(async ({ data }) => {
    const row = await findByProtocolAndKey(data.protocol, data.key);
    const db = await admin();
    const { error } = await db.from("anonymous_submission_messages").insert({
      submission_id: row.id,
      from_gg: false,
      body: data.body,
      sent_on: todayBR(),
    });
    if (error) throw new Error("Não conseguimos enviar agora. Tenta de novo em instantes?");
    await notify(row.channel as Channel, `nova mensagem em ${row.protocol}`, "Quem enviou respondeu.");
    return { ok: true };
  });

// ── Painel do G&G ─────────────────────────────────────────────────────

export const listAnonymousSubmissions = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .validator(z.object({ channel: z.enum(CHANNELS) }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: rows, error } = await db
      .from("anonymous_submissions")
      .select("id, channel, protocol, category, payload, status, received_on, updated_at")
      .eq("channel", data.channel)
      .order("received_on", { ascending: false })
      .order("protocol");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      ...r,
      channel: r.channel as Channel,
      status: r.status as SubmissionStatus,
      // Todos os campos dos dois formulários são texto (ver os schemas em anonymous-defs).
      payload: r.payload as Record<string, string>,
    }));
  });

export const listAnonymousMessages = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => messagesOf(data.id));

export const respondAnonymous = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(5000) }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("anonymous_submission_messages").insert({
      submission_id: data.id,
      from_gg: true,
      body: data.body,
      sent_on: todayBR(),
    });
    if (error) throw new Error(error.message);
    // Respondeu, então está em análise — a não ser que já tenha sido concluído.
    await db
      .from("anonymous_submissions")
      .update({ status: "em_analise", updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "recebido");
    return { ok: true };
  });

export const setAnonymousStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string().uuid(), status: z.enum(SUBMISSION_STATUSES) }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db
      .from("anonymous_submissions")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
