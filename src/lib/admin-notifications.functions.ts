import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "@/integrations/supabase/admin-middleware";
import { CHANNEL_META, type Channel } from "@/lib/channel-defs";

/**
 * Sino do painel: tudo que está esperando o G&G agir.
 *
 * Não existe "lido/não lido" por admin — a fila é do time. Uma notificação some quando alguém
 * do G&G resolve o que ela pede (responde, conclui, aprova), não quando alguém abre o sino.
 *
 * - SIM e Canal de Escuta: envio ainda em "recebido", ou em andamento com a última mensagem
 *   vinda de quem enviou.
 * - Solicitações: "em análise", ou "respondida" com a última mensagem do colaborador.
 * - Atualização cadastral pendente e reconhecimento em revisão.
 *
 * Do envio sem identificação só sai o protocolo e o assunto — nada de autor.
 */

export type NotificationKind = "sim" | "escuta" | "solicitacao" | "cadastral" | "reconhecimento";

export type AdminNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  /** Data (AAAA-MM-DD) ou instante ISO — o que a origem tiver. */
  date: string;
};

export type AdminNotifications = {
  total: number;
  counts: Record<NotificationKind, number>;
  /** As mais recentes primeiro, no máximo `MAX_ITEMS`. */
  items: AdminNotification[];
};

const MAX_ITEMS = 30;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Id → última mensagem, dada uma lista já ordenada da mais antiga para a mais nova. */
function lastBy<T>(rows: T[], key: (r: T) => string): Map<string, T> {
  const last = new Map<string, T>();
  for (const r of rows) last.set(key(r), r);
  return last;
}

async function channelNotifications(): Promise<AdminNotification[]> {
  const supabase = await db();
  const { data: open, error } = await supabase
    .from("channel_submissions")
    .select("id, channel, protocol, category, status, received_on")
    .neq("status", "concluido");
  fail(error);
  const rows = open ?? [];
  if (rows.length === 0) return [];

  const ongoing = rows.filter((r) => r.status !== "recebido").map((r) => r.id);
  let lastMessage = new Map<string, { submission_id: string; from_gg: boolean; sent_on: string }>();
  if (ongoing.length > 0) {
    const { data: msgs, error: msgError } = await supabase
      .from("channel_submission_messages")
      .select("submission_id, from_gg, sent_on")
      .in("submission_id", ongoing)
      .order("seq");
    fail(msgError);
    lastMessage = lastBy(msgs ?? [], (m) => m.submission_id);
  }

  const out: AdminNotification[] = [];
  for (const r of rows) {
    const channel = r.channel as Channel;
    // `category` já é gravada como rótulo (ver `submitToChannel`).
    const subject = r.category;
    const last = lastMessage.get(r.id);
    if (r.status === "recebido") {
      out.push({
        id: r.id,
        kind: channel,
        title: `Novo envio no ${CHANNEL_META[channel].short}`,
        detail: `${r.protocol} · ${subject}`,
        date: r.received_on,
      });
    } else if (last && !last.from_gg) {
      out.push({
        id: r.id,
        kind: channel,
        title: `Nova resposta no ${CHANNEL_META[channel].short}`,
        detail: `${r.protocol} · ${subject}`,
        date: last.sent_on,
      });
    }
  }
  return out;
}

async function requestNotifications(): Promise<AdminNotification[]> {
  const supabase = await db();
  const { data: open, error } = await supabase
    .from("requests")
    .select("id, protocol, title, status, employee_id, created_at")
    .in("status", ["em_analise", "respondida"]);
  fail(error);
  const rows = open ?? [];
  if (rows.length === 0) return [];

  const answered = rows.filter((r) => r.status === "respondida").map((r) => r.id);
  let lastMessage = new Map<
    string,
    { request_id: string; author_id: string | null; created_at: string }
  >();
  if (answered.length > 0) {
    const { data: msgs, error: msgError } = await supabase
      .from("request_messages")
      .select("request_id, author_id, created_at")
      .in("request_id", answered)
      .order("created_at");
    fail(msgError);
    lastMessage = lastBy(msgs ?? [], (m) => m.request_id);
  }

  const pending = rows.flatMap((r) => {
    if (r.status === "em_analise") {
      return [{ r, reply: false, date: r.created_at }];
    }
    const last = lastMessage.get(r.id);
    // Resposta do próprio colaborador: a bola voltou para o G&G.
    return last && last.author_id === r.employee_id
      ? [{ r, reply: true, date: last.created_at }]
      : [];
  });
  if (pending.length === 0) return [];

  const names = await employeeNames(pending.map((p) => p.r.employee_id));
  return pending.map(({ r, reply, date }) => ({
    id: r.id,
    kind: "solicitacao" as const,
    title: reply ? "Colaborador respondeu uma solicitação" : "Nova solicitação",
    detail: `#${r.protocol} · ${r.title} · ${names.get(r.employee_id) ?? "Colaborador"}`,
    date,
  }));
}

async function profileNotifications(): Promise<AdminNotification[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("profile_update_requests")
    .select("id, employee_id, created_at")
    .eq("status", "pendente");
  fail(error);
  const rows = data ?? [];
  const names = await employeeNames(rows.map((r) => r.employee_id));
  return rows.map((r) => ({
    id: r.id,
    kind: "cadastral" as const,
    title: "Atualização cadastral para revisar",
    detail: names.get(r.employee_id) ?? "Colaborador",
    date: r.created_at,
  }));
}

async function recognitionNotifications(): Promise<AdminNotification[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("peer_recognitions")
    .select("id, to_employee_id, created_at")
    .eq("status", "em_revisao");
  fail(error);
  const rows = data ?? [];
  const names = await employeeNames(rows.map((r) => r.to_employee_id));
  return rows.map((r) => ({
    id: r.id,
    kind: "reconhecimento" as const,
    title: "Reconhecimento aguardando revisão",
    detail: `Para ${names.get(r.to_employee_id) ?? "colaborador"}`,
    date: r.created_at,
  }));
}

async function employeeNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const supabase = await db();
  const { data, error } = await supabase.from("employees").select("id, name").in("id", unique);
  fail(error);
  return new Map((data ?? []).map((e) => [e.id, e.name ?? ""]));
}

export const getAdminNotifications = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async (): Promise<AdminNotifications> => {
    const all = (
      await Promise.all([
        channelNotifications(),
        requestNotifications(),
        profileNotifications(),
        recognitionNotifications(),
      ])
    ).flat();

    const counts: Record<NotificationKind, number> = {
      sim: 0,
      escuta: 0,
      solicitacao: 0,
      cadastral: 0,
      reconhecimento: 0,
    };
    for (const n of all) counts[n.kind] += 1;

    // "AAAA-MM-DD" e ISO comparam certo como texto: o dia vem antes da hora.
    const items = [...all].sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_ITEMS);
    return { total: all.length, counts, items };
  });
