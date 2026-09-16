import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "@/integrations/supabase/admin-middleware";
import {
  CHANNEL_META,
  CHANNEL_OF_PREFIX,
  CHANNELS,
  SUBMISSION_STATUSES,
  normalizeAccessKey,
  normalizeProtocol,
  simSchema,
  simSectors,
  type Channel,
  type SubmissionStatus,
} from "@/lib/channel-defs";
import { CPF_LOGIN_DOMAIN } from "@/lib/cpf";
import { normalizeSiteUrl } from "@/lib/site-url";
import type { Json } from "@/integrations/supabase/types";

const SITE_URL = normalizeSiteUrl(process.env.SITE_URL);

/**
 * SIM (e, no PR seguinte, Canal de Escuta).
 *
 * Regra da casa no envio sem identificação: **nada que ligue o envio a quem escreveu**. O login
 * é exigido (é canal interno), mas o id serve só para conferir que é colaborador ativo — não é
 * gravado, não vai para log, não vai no e-mail. Nenhum `console.*` com conteúdo de envio neste
 * arquivo.
 *
 * No envio identificado, o autor e o nome vêm do login, aqui no servidor — a tela não manda nome.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Colaborador ativo do login. Quem chama decide se o id é gravado (só no envio identificado). */
async function activeEmployee(userId: string) {
  const db = await admin();
  const { data } = await db
    .from("employees")
    .select("id, name")
    .or(`auth_user_id.eq.${userId},id.eq.${userId}`)
    .eq("active", true)
    .limit(1);
  const row = data?.[0];
  if (!row) throw new Error("Não encontramos seu cadastro de colaborador. Fala com o G&G?");
  return { id: row.id as string, name: (row.name as string) ?? "" };
}

function userIdOf(context: unknown): string {
  return (context as { userId: string }).userId;
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
async function notifyGG(channel: Channel, subject: string, text: string) {
  try {
    const { notifyGG } = await import("@/lib/notify.server");
    await notifyGG(
      `${CHANNEL_META[channel].short} — ${subject}`,
      `<p>${text}</p><p>O conteúdo fica só no painel.</p>` +
        `<p><a href="${SITE_URL}/admin/canais?canal=${channel}">Abrir no painel</a></p>`,
    );
  } catch {
    // A notificação nunca derruba o envio — e o erro não vai para log com dados do envio.
  }
}

/**
 * Aviso a quem enviou identificado: só o protocolo e o link, como no aviso ao G&G. Quem entra por
 * CPF tem e-mail sintético, sem caixa postal — esses acompanham pelo Perfil.
 */
async function notifyAuthor(submission: { id: string; protocol: string; author_employee_id: string | null }, text: string) {
  if (!submission.author_employee_id) return;
  try {
    const db = await admin();
    const { data } = await db
      .from("employees")
      .select("email")
      .eq("id", submission.author_employee_id)
      .maybeSingle();
    const email = data?.email?.trim();
    if (!email || email.toLowerCase().endsWith(`@${CPF_LOGIN_DOMAIN}`)) return;
    const { sendEmail } = await import("@/lib/notify.server");
    await sendEmail(
      [email],
      `Seu SIM ${submission.protocol} — ${text}`,
      `<p>${text} no seu SIM <strong>${submission.protocol}</strong>.</p>` +
        `<p><a href="${SITE_URL}/sim/${submission.id}">Ver no portal</a></p>`,
    );
  } catch {
    // Mesmo motivo do aviso ao G&G.
  }
}

/** O setor é um dos ativos da tabela `departments` (ou "Outro"). Sem a tabela, vale a lista fixa. */
async function validSector(sector: string): Promise<boolean> {
  const db = await admin();
  const { data, error } = await db.from("departments").select("name").eq("active", true);
  const names = error || !data?.length ? undefined : data.map((d) => d.name);
  return simSectors(names).includes(sector);
}

const DETAIL_COLUMNS =
  "id, channel, protocol, category, payload, status, received_on, author_employee_id" as const;

type DetailRow = {
  id: string;
  channel: string;
  protocol: string;
  category: string;
  payload: Json;
  status: string;
  received_on: string;
};

async function messagesOf(submissionId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("channel_submission_messages")
    .select("id, from_gg, body, sent_on")
    .eq("submission_id", submissionId)
    .order("seq");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** O que quem enviou vê: o envio, o status e a conversa. */
async function toDetail(row: DetailRow) {
  return {
    id: row.id,
    channel: row.channel as Channel,
    protocol: row.protocol,
    category: row.category,
    status: row.status as SubmissionStatus,
    received_on: row.received_on,
    // Todos os campos do formulário são texto (ver `simSchema`).
    payload: row.payload as Record<string, string>,
    messages: await messagesOf(row.id),
  };
}

export type SubmissionDetail = Awaited<ReturnType<typeof toDetail>>;

async function insertMessage(submissionId: string, fromGg: boolean, body: string) {
  const db = await admin();
  const { error } = await db.from("channel_submission_messages").insert({
    submission_id: submissionId,
    from_gg: fromGg,
    body,
    sent_on: todayBR(),
  });
  if (error) throw new Error("Não conseguimos enviar agora. Tenta de novo em instantes?");
}

const CLOSED = "Este envio já foi concluído. Se precisar, envie um novo.";

// ── Colaborador: envio ────────────────────────────────────────────────

export const submitToChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      channel: z.enum(CHANNELS),
      identified: z.boolean(),
      payload: z.record(z.unknown()),
    }),
  )
  .handler(async ({ data, context }) => {
    const me = await activeEmployee(userIdOf(context));

    const parsed = simSchema.safeParse(data.payload);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Confere os campos do formulário?");
    }
    const { contact, ...fields } = parsed.data;
    if (!(await validSector(fields.sector))) throw new Error("Escolha o setor.");

    // Identificado: nome do cadastro e contato que a pessoa confirmou. Anônimo: nada disso.
    const author = data.identified ? me : null;
    const payload = author ? { ...fields, contact_name: author.name, contact } : fields;
    const key = author ? null : `${await randomCode(4)}-${await randomCode(4)}`;
    const accessKeyHash = key ? await sha256(key) : null;

    const db = await admin();
    // Protocolo aleatório (não sequencial: a sequência diria quantos envios existem e em que
    // ordem chegaram). Colisão é improvável; se acontecer, tenta de novo.
    for (let attempt = 0; attempt < 5; attempt++) {
      const protocol = `${CHANNEL_META[data.channel].prefix}-${await randomCode(6)}`;
      const { data: row, error } = await db
        .from("channel_submissions")
        .insert({
          channel: data.channel,
          protocol,
          access_key_hash: accessKeyHash,
          author_employee_id: author?.id ?? null,
          category: fields.reason,
          payload: payload as Json,
          received_on: todayBR(),
        })
        .select("id")
        .single();
      if (!error) {
        await notifyGG(data.channel, `novo envio ${protocol}`, "Chegou um novo envio pelo portal.");
        // O id só volta no identificado: é o link do envio no Perfil.
        return { protocol, key, id: author ? row.id : null };
      }
      if (!/duplicate|unique/i.test(error.message)) {
        throw new Error("Não conseguimos registrar agora. Tenta de novo em instantes?");
      }
    }
    throw new Error("Não conseguimos registrar agora. Tenta de novo em instantes?");
  });

// ── Colaborador: acompanhamento por protocolo + chave ─────────────────

const byKeyInput = z.object({
  protocol: z.string().max(20).transform(normalizeProtocol),
  key: z.string().max(20).transform(normalizeAccessKey),
});

const NOT_FOUND = "Protocolo ou chave não conferem. Confira os dois e tente de novo.";

/** Resposta igual para "não existe", "chave errada" e "envio identificado" (que não tem chave). */
async function findByProtocolAndKey(protocol: string, key: string) {
  if (!CHANNEL_OF_PREFIX[protocol.slice(0, 3)]) throw new Error(NOT_FOUND);
  const db = await admin();
  const { data } = await db
    .from("channel_submissions")
    .select(
      "id, channel, protocol, category, payload, status, received_on, author_employee_id, access_key_hash",
    )
    .eq("protocol", protocol)
    .maybeSingle();
  const keyHash = await sha256(key);
  if (!data?.access_key_hash || !(await sameHash(data.access_key_hash, keyHash))) {
    throw new Error(NOT_FOUND);
  }
  return data;
}

export const followUpByKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(byKeyInput)
  .handler(async ({ data }) => toDetail(await findByProtocolAndKey(data.protocol, data.key)));

export const replyByKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(byKeyInput.extend({ body: z.string().trim().min(1).max(5000) }))
  .handler(async ({ data }) => {
    const row = await findByProtocolAndKey(data.protocol, data.key);
    if (row.status === "concluido") throw new Error(CLOSED);
    await insertMessage(row.id, false, data.body);
    await notifyGG(row.channel as Channel, `nova mensagem em ${row.protocol}`, "Quem enviou respondeu.");
    return { ok: true };
  });

// ── Colaborador: envios identificados (Perfil) ────────────────────────

export const listMySubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await activeEmployee(userIdOf(context));
    const db = await admin();
    const { data, error } = await db
      .from("channel_submissions")
      .select("id, channel, protocol, category, status, received_on")
      .eq("author_employee_id", me.id)
      .order("received_on", { ascending: false })
      .order("protocol");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      ...r,
      channel: r.channel as Channel,
      status: r.status as SubmissionStatus,
    }));
  });

/** Envio identificado de quem está logado. Envio de outra pessoa dá "não encontrado". */
async function findMine(userId: string, id: string) {
  const me = await activeEmployee(userId);
  const db = await admin();
  const { data } = await db
    .from("channel_submissions")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .eq("author_employee_id", me.id)
    .maybeSingle();
  if (!data) throw new Error("Não encontramos esse envio no seu nome.");
  return data;
}

export const getMySubmission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => toDetail(await findMine(userIdOf(context), data.id)));

export const replyMySubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(5000) }))
  .handler(async ({ data, context }) => {
    const row = await findMine(userIdOf(context), data.id);
    if (row.status === "concluido") throw new Error(CLOSED);
    await insertMessage(row.id, false, data.body);
    await notifyGG(row.channel as Channel, `nova mensagem em ${row.protocol}`, "Quem enviou respondeu.");
    return { ok: true };
  });

// ── Painel do G&G ─────────────────────────────────────────────────────

export const listChannelSubmissions = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .validator(z.object({ channel: z.enum(CHANNELS) }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: rows, error } = await db
      .from("channel_submissions")
      .select("id, channel, protocol, category, payload, status, received_on, updated_at, author_employee_id")
      .eq("channel", data.channel)
      .order("received_on", { ascending: false })
      .order("protocol");
    if (error) throw new Error(error.message);
    return (rows ?? []).map(({ author_employee_id, ...r }) => ({
      ...r,
      channel: r.channel as Channel,
      status: r.status as SubmissionStatus,
      // O painel sabe só se a pessoa se identificou; o nome é o que está no próprio envio.
      identified: author_employee_id != null,
      payload: r.payload as Record<string, string>,
    }));
  });

export const listChannelMessages = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => messagesOf(data.id));

async function submissionForNotice(id: string) {
  const db = await admin();
  const { data } = await db
    .from("channel_submissions")
    .select("id, protocol, author_employee_id")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export const respondChannelSubmission = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(5000) }))
  .handler(async ({ data }) => {
    await insertMessage(data.id, true, data.body);
    const db = await admin();
    // Respondeu, então está em análise — a não ser que já tenha sido concluído.
    await db
      .from("channel_submissions")
      .update({ status: "em_analise", updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "recebido");
    const row = await submissionForNotice(data.id);
    if (row) await notifyAuthor(row, "O G&G respondeu");
    return { ok: true };
  });

export const setChannelSubmissionStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string().uuid(), status: z.enum(SUBMISSION_STATUSES) }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db
      .from("channel_submissions")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.status === "concluido") {
      const row = await submissionForNotice(data.id);
      if (row) await notifyAuthor(row, "O G&G concluiu");
    }
    return { ok: true };
  });
