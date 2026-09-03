import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "@/integrations/supabase/admin-middleware";
import { normalizeSiteUrl } from "@/lib/site-url";
import {
  EDUCATION_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  PROFILE_FIELD_KEYS,
  changedFieldLabels,
  diffProfile,
  type ProfileChanges,
} from "@/lib/profile-fields";

const SITE_URL = normalizeSiteUrl(process.env.SITE_URL);

/* ─── Tipos ────────────────────────────────────────────────────────────────── */

export type OwnProfile = {
  id: string;
  auth_user_id: string | null;
  name: string;
  email: string | null;
  department: string | null;
  job_title: string | null;
  admission_date: string | null;
  photo_url: string | null;
  phone: string | null;
  birth_date: string | null;
  marital_status: string | null;
  education_level: string | null;
  dependents: string | null;
  address_zip: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
};

export type ProfileRequest = {
  id: string;
  employee_id: string;
  status: string;
  changes: ProfileChanges;
  note: string | null;
  reviewer_name: string | null;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type AdminProfileRequest = ProfileRequest & {
  employee: {
    id: string;
    name: string;
    email: string | null;
    department: string | null;
    job_title: string | null;
    photo_url: string | null;
    /** valores atuais dos campos solicitados — para detectar divergência */
    current: Record<string, string | null>;
  } | null;
};

const PROFILE_SELECT =
  "id, auth_user_id, name, email, department, job_title, admission_date, photo_url, " +
  "phone, birth_date, marital_status, education_level, dependents, " +
  "address_zip, address_street, address_number, address_complement, " +
  "address_district, address_city, address_state";

const REQUEST_SELECT =
  "id, employee_id, status, changes, note, reviewer_name, reviewer_note, reviewed_at, created_at";

/* ─── Validação ────────────────────────────────────────────────────────────── */

const blank = z.literal("");
const enumOrBlank = (options: string[]) =>
  z.union([blank, z.enum(options as [string, ...string[]])]);

const proposedSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    email: z.union([blank, z.string().trim().email().max(160)]),
    phone: z.string().trim().max(30),
    birth_date: z.union([blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
    marital_status: enumOrBlank(MARITAL_STATUS_OPTIONS),
    education_level: enumOrBlank(EDUCATION_OPTIONS),
    dependents: z.string().trim().max(2000),
    address_zip: z.string().trim().max(12),
    address_street: z.string().trim().max(160),
    address_number: z.string().trim().max(20),
    address_complement: z.string().trim().max(80),
    address_district: z.string().trim().max(120),
    address_city: z.string().trim().max(120),
    address_state: z.union([
      blank,
      z
        .string()
        .trim()
        .regex(/^[A-Za-z]{2}$/),
    ]),
  })
  .partial()
  .strict();

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function asChanges(value: unknown): ProfileChanges {
  return (value ?? {}) as ProfileChanges;
}

/** Converte `changes` no patch a ser gravado em employees (só chaves da allowlist). */
function patchFromChanges(changes: ProfileChanges): Record<string, string | null> {
  const patch: Record<string, string | null> = {};
  for (const key of PROFILE_FIELD_KEYS) {
    const change = changes[key];
    if (!change) continue;
    const value = change.to === null || change.to.trim() === "" ? null : change.to.trim();
    // name é NOT NULL no banco — nunca apagar
    if (key === "name" && value === null) continue;
    patch[key] = key === "address_state" && value ? value.toUpperCase() : value;
  }
  return patch;
}

/** employees.email é UNIQUE e espelha a credencial de login. */
async function assertEmailAvailable(email: string, employeeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("employees")
    .select("id")
    .eq("email", email)
    .neq("id", employeeId)
    .maybeSingle();
  if (data) throw new Error("Este e-mail já está em uso por outro colaborador.");
}

/* ─── Colaborador ──────────────────────────────────────────────────────────── */

export const getOwnProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnProfile | null> => {
    const { userId } = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select(PROFILE_SELECT)
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? null) as OwnProfile | null;
  });

export const listOwnProfileRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileRequest[]> => {
    const { userId } = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profile_update_requests")
      .select(REQUEST_SELECT)
      .eq("auth_user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as ProfileRequest[]).map((r) => ({
      ...r,
      changes: asChanges(r.changes),
    }));
  });

export const createProfileUpdateRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ proposed: proposedSchema, note: z.string().trim().max(1000).optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: employeeRow, error: empError } = await supabaseAdmin
      .from("employees")
      .select(PROFILE_SELECT)
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (empError) throw new Error(empError.message);
    const employee = employeeRow as unknown as OwnProfile | null;
    if (!employee) {
      throw new Error("Seu cadastro ainda não está vinculado ao portal. Fale com Gente & Gestão.");
    }

    const { data: pending } = await supabaseAdmin
      .from("profile_update_requests")
      .select("id")
      .eq("employee_id", employee.id)
      .eq("status", "pendente")
      .maybeSingle();
    if (pending) {
      throw new Error("Você já tem uma solicitação em análise. Cancele-a antes de enviar outra.");
    }

    // Diff refeito no servidor — o cliente não decide o que muda
    const changes = diffProfile(
      employee as unknown as Record<string, unknown>,
      data.proposed as Record<string, unknown>,
    );
    if (Object.keys(changes).length === 0) {
      throw new Error("Nenhuma alteração detectada nos dados enviados.");
    }

    if (changes.email?.to) await assertEmailAvailable(changes.email.to, employee.id);

    const { data: created, error } = await supabaseAdmin
      .from("profile_update_requests")
      .insert({
        employee_id: employee.id,
        auth_user_id: userId,
        status: "pendente",
        changes,
        note: data.note || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // A notificação nunca derruba a criação da solicitação
    try {
      const { notifyGG, escapeHtml } = await import("@/lib/notify.server");
      const labels = changedFieldLabels(changes);
      await notifyGG(
        `Nova solicitação de atualização cadastral — ${employee.name}`,
        `<p><strong>${escapeHtml(employee.name)}</strong>` +
          (employee.department ? ` — ${escapeHtml(employee.department)}` : "") +
          `</p><p>Campos solicitados: ${escapeHtml(labels.join(", "))}</p>` +
          (data.note ? `<p>Observação: ${escapeHtml(data.note)}</p>` : "") +
          `<p><a href="${SITE_URL}/admin/solicitacoes">Abrir no painel</a></p>`,
      );
    } catch (e) {
      console.error("[profile-request] notificação por e-mail falhou", e);
    }

    return { ok: true, id: created.id };
  });

export const cancelOwnProfileRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profile_update_requests")
      .update({ status: "cancelada", updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("auth_user_id", userId)
      .eq("status", "pendente");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ─── Admin ────────────────────────────────────────────────────────────────── */

export const listProfileRequests = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async (): Promise<AdminProfileRequest[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profile_update_requests")
      .select(REQUEST_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const requests = ((data ?? []) as unknown as ProfileRequest[]).map((r) => ({
      ...r,
      changes: asChanges(r.changes),
    }));
    if (requests.length === 0) return [];

    const ids = Array.from(new Set(requests.map((r) => r.employee_id)));
    const { data: employees, error: empError } = await supabaseAdmin
      .from("employees")
      .select(PROFILE_SELECT)
      .in("id", ids);
    if (empError) throw new Error(empError.message);

    const byId = new Map(((employees ?? []) as unknown as OwnProfile[]).map((e) => [e.id, e]));

    return requests.map((r) => {
      const e = byId.get(r.employee_id);
      if (!e) return { ...r, employee: null };
      const record = e as unknown as Record<string, string | null>;
      const current: Record<string, string | null> = {};
      for (const key of Object.keys(r.changes)) current[key] = record[key] ?? null;
      return {
        ...r,
        employee: {
          id: e.id,
          name: e.name,
          email: e.email,
          department: e.department,
          job_title: e.job_title,
          photo_url: e.photo_url,
          current,
        },
      };
    });
  });

export const countPendingProfileRequests = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async (): Promise<number> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("profile_update_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente");
    if (error) return 0;
    return count ?? 0;
  });

export const approveProfileUpdateRequest = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((data: unknown) =>
    z
      .object({ id: z.string().uuid(), reviewer_note: z.string().trim().max(1000).optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context as { admin: { id: string; name: string } };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: request, error: reqError } = await supabaseAdmin
      .from("profile_update_requests")
      .select("id, employee_id, status, changes")
      .eq("id", data.id)
      .maybeSingle();
    if (reqError) throw new Error(reqError.message);
    if (!request) throw new Error("Solicitação não encontrada.");
    if (request.status !== "pendente") throw new Error("Esta solicitação já foi revisada.");

    const changes = asChanges(request.changes);
    const patch = patchFromChanges(changes);
    if (Object.keys(patch).length === 0) throw new Error("Nada a aplicar nesta solicitação.");

    const { data: employee, error: empError } = await supabaseAdmin
      .from("employees")
      .select("id, auth_user_id, email")
      .eq("id", request.employee_id)
      .maybeSingle();
    if (empError) throw new Error(empError.message);
    if (!employee) throw new Error("Colaborador não encontrado.");

    // O e-mail também é a credencial de login: atualiza o Auth antes do banco
    if (patch.email && patch.email !== employee.email) {
      await assertEmailAvailable(patch.email, employee.id);
      if (employee.auth_user_id) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(employee.auth_user_id, {
          email: patch.email,
        });
        if (error) throw new Error(error.message);
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("employees")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", employee.id);
    if (updateError) throw new Error(updateError.message);

    const { error } = await supabaseAdmin
      .from("profile_update_requests")
      .update({
        status: "aprovada",
        reviewer_id: admin.id,
        reviewer_name: admin.name,
        reviewer_note: data.reviewer_note || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id);
    if (error) throw new Error(error.message);

    return { ok: true, applied: Object.keys(patch).length };
  });

export const rejectProfileUpdateRequest = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((data: unknown) =>
    z
      .object({ id: z.string().uuid(), reviewer_note: z.string().trim().min(3).max(1000) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context as { admin: { id: string; name: string } };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("profile_update_requests")
      .update({
        status: "rejeitada",
        reviewer_id: admin.id,
        reviewer_name: admin.name,
        reviewer_note: data.reviewer_note,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "pendente")
      .select("id");
    if (error) throw new Error(error.message);
    if (!updated || updated.length === 0) throw new Error("Esta solicitação já foi revisada.");
    return { ok: true };
  });
