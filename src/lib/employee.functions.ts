import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "@/integrations/supabase/admin-middleware";
import { normalizeSiteUrl } from "@/lib/site-url";

const SITE_URL = normalizeSiteUrl(process.env.SITE_URL);
const CONFIRM_URL = `${SITE_URL}/colaborador/confirmar`;

const emailSchema = z.string().email();

// Cria convite + insere novo colaborador (sem registro prévio no diretório)
export const inviteEmployee = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(
    z.object({
      name: z.string().min(2).max(120),
      email: emailSchema,
      department: z.string().max(120).optional(),
      job_title: z.string().max(120).optional(),
      unit: z.string().max(120).optional(),
      phone: z.string().max(30).optional(),
      birth_date: z.string().optional(),
      admission_date: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: CONFIRM_URL,
      data: { name: data.name },
    });
    if (error) throw new Error(error.message);
    const { error: dbError } = await supabaseAdmin.from("employees").insert({
      id: invited.user.id,
      auth_user_id: invited.user.id,
      name: data.name,
      email: data.email,
      department: data.department ?? null,
      job_title: data.job_title ?? null,
      unit: data.unit ?? null,
      phone: data.phone ?? null,
      birth_date: data.birth_date ?? null,
      admission_date: data.admission_date ?? null,
      invited_at: new Date().toISOString(),
    });
    if (dbError) throw new Error(dbError.message);
    return { ok: true, id: invited.user.id };
  });

// Cadastra colaborador no diretório sem enviar convite (email opcional)
export const addEmployee = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(
    z.object({
      name: z.string().min(2).max(120),
      email: emailSchema.optional(),
      department: z.string().max(120).optional(),
      job_title: z.string().max(120).optional(),
      unit: z.string().max(120).optional(),
      phone: z.string().max(30).optional(),
      birth_date: z.string().optional(),
      admission_date: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { randomUUID } = await import("crypto");
    const { error } = await supabaseAdmin.from("employees").insert({
      id: randomUUID(),
      name: data.name,
      email: data.email ?? null,
      department: data.department ?? null,
      job_title: data.job_title ?? null,
      unit: data.unit ?? null,
      phone: data.phone ?? null,
      birth_date: data.birth_date ?? null,
      admission_date: data.admission_date ?? null,
      active: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Dá acesso ao portal para colaborador do diretório.
// Se o e-mail já tiver conta no Auth, vincula direto (sem novo convite).
export const inviteExistingEmployee = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ employeeId: z.string().uuid(), email: emailSchema }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: CONFIRM_URL,
    });

    if (error) {
      // Usuário já registrado — vincula a conta existente sem reenviar convite
      if (error.message.toLowerCase().includes("already")) {
        const { data: existing } = await supabaseAdmin
          .from("admin_users")
          .select("id")
          .eq("email", data.email)
          .single();
        if (!existing) throw new Error(error.message);
        const { error: dbErr } = await supabaseAdmin
          .from("employees")
          .update({
            auth_user_id: existing.id,
            email: data.email,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.employeeId);
        if (dbErr) throw new Error(dbErr.message);
        return { ok: true, linked: true };
      }
      throw new Error(error.message);
    }

    const { error: dbError } = await supabaseAdmin
      .from("employees")
      .update({
        auth_user_id: invited.user.id,
        email: data.email,
        invited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.employeeId);
    if (dbError) throw new Error(dbError.message);
    return { ok: true };
  });

export const resendEmployeeInvite = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ employeeId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emp, error: fetchErr } = await supabaseAdmin
      .from("employees")
      .select("email")
      .eq("id", data.employeeId)
      .single();
    if (fetchErr || !emp) throw new Error("Colaborador não encontrado.");
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(emp.email!, {
      redirectTo: CONFIRM_URL,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("employees")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", data.employeeId);
    return { ok: true };
  });

export const triggerEmployeePasswordReset = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ email: emailSchema }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // auth.admin.generateLink() apenas GERA o link e o devolve na resposta — não
    // envia e-mail. resetPasswordForEmail é o método que faz o GoTrue disparar.
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: CONFIRM_URL,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateEmployee = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(
    z.object({
      id: z.string().uuid(),
      name: z.string().min(2).max(120).optional(),
      email: emailSchema.optional(),
      department: z.string().max(120).nullish(),
      job_title: z.string().max(120).nullish(),
      unit: z.string().max(120).nullish(),
      phone: z.string().max(30).nullish(),
      birth_date: z.string().nullish(),
      admission_date: z.string().nullish(),
      active: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Busca auth_user_id antes de qualquer operação no Auth
    const { data: existing } = await supabaseAdmin
      .from("employees")
      .select("auth_user_id")
      .eq("id", data.id)
      .single();
    const authUserId = existing?.auth_user_id as string | null | undefined;

    if (authUserId) {
      const authPatch: { email?: string; ban_duration?: string } = {};
      if (data.email) authPatch.email = data.email;
      if (data.active === false) authPatch.ban_duration = "876600h";
      if (data.active === true) authPatch.ban_duration = "none";
      if (Object.keys(authPatch).length > 0) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(authUserId, authPatch);
        if (error) throw new Error(error.message);
      }
    }

    const patch = {
      updated_at: new Date().toISOString(),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.department !== undefined && { department: data.department }),
      ...(data.job_title !== undefined && { job_title: data.job_title }),
      ...(data.unit !== undefined && { unit: data.unit }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.birth_date !== undefined && { birth_date: data.birth_date }),
      ...(data.admission_date !== undefined && { admission_date: data.admission_date }),
      ...(data.active !== undefined && { active: data.active }),
    };
    const { error } = await supabaseAdmin.from("employees").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const EMPLOYEE_COLUMNS =
  "id, auth_user_id, name, email, department, job_title, unit, phone, birth_date, admission_date, active, invited_at, created_at, photo_url";

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select(EMPLOYEE_COLUMNS)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Remove só o registro do diretório. A conta de acesso (auth.users), quando
    // existe, é desfeita separadamente em Usuários admin — apagar aqui seria
    // destrutivo demais para uma ação de linha de tabela.
    const { error } = await supabaseAdmin.from("employees").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateEmployeePhotoUrl = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.string().uuid(), photo_url: z.string().url() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("employees")
      .update({ photo_url: data.photo_url, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkImportEmployees = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(
    z.object({
      employees: z.array(
        z.object({
          name: z.string().min(2).max(120),
          email: z.string().email().optional(),
          department: z.string().max(120).optional(),
          job_title: z.string().max(120).optional(),
          unit: z.string().max(120).optional(),
          admission_date: z.string().optional(),
          birth_date: z.string().optional(),
        }),
      ),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { randomUUID } = await import("crypto");

    // Carrega colaboradores existentes
    const { data: existing } = await supabaseAdmin
      .from("employees")
      .select("id, name, email, birth_date, admission_date, department, job_title");

    type Emp = {
      id: string;
      name: string;
      email: string | null;
      birth_date: string | null;
      admission_date: string | null;
      department: string | null;
      job_title: string | null;
    };
    const employees = (existing ?? []) as Emp[];

    // Normaliza: minúsculo, sem acentos, espaços comprimidos.
    // "CÉLIO DE BRITTO" e "Celio de Britto" viram "celio de britto".
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/\s+/g, " ")
        .trim();

    // Índice por nome completo normalizado
    const byFullName = new Map(employees.map((e) => [norm(e.name), e]));

    // Índice por primeiro nome → null se ambíguo (mais de um colaborador)
    const byFirstName = new Map<string, Emp | null>();
    for (const e of employees) {
      const first = norm(e.name).split(" ")[0];
      byFirstName.set(first, byFirstName.has(first) ? null : e);
    }

    const findMatch = (name: string): Emp | null => {
      const key = norm(name);
      const exact = byFullName.get(key);
      if (exact) return exact;
      const first = key.split(" ")[0];
      return byFirstName.get(first) ?? null;
    };

    let updated = 0;
    let inserted = 0;
    let skipped = 0;

    for (const emp of data.employees) {
      const match = findMatch(emp.name);

      if (match) {
        // Atualiza campos ausentes/novos — nunca sobrescreve dados existentes sem motivo
        const patch: {
          email?: string;
          birth_date?: string;
          admission_date?: string;
          department?: string;
          job_title?: string;
          unit?: string;
          updated_at?: string;
        } = {};
        if (emp.email && !match.email) patch.email = emp.email;
        if (emp.birth_date && !match.birth_date) patch.birth_date = emp.birth_date;
        if (emp.admission_date && !match.admission_date) patch.admission_date = emp.admission_date;
        if (emp.department) patch.department = emp.department;
        if (emp.job_title) patch.job_title = emp.job_title;
        if (emp.unit) patch.unit = emp.unit;

        if (Object.keys(patch).length === 0) {
          skipped++;
          continue;
        }

        patch.updated_at = new Date().toISOString();
        const { error } = await supabaseAdmin
          .from("employees")
          .update(patch as never)
          .eq("id", match.id);
        if (!error) updated++;
      } else {
        // Insere novo colaborador sem conta de acesso
        const { error } = await supabaseAdmin.from("employees").insert({
          id: randomUUID(),
          name: emp.name,
          email: emp.email ?? null,
          department: emp.department ?? null,
          job_title: emp.job_title ?? null,
          unit: emp.unit ?? null,
          birth_date: emp.birth_date ?? null,
          admission_date: emp.admission_date ?? null,
          active: true,
        });
        if (!error) inserted++;
      }
    }

    return { ok: true, updated, inserted, skipped };
  });

/**
 * Colaborador do usuário autenticado.
 * Resolve por `auth_user_id` e cai para `id` (vínculos antigos gravaram só o `id`).
 * Privacidade: o aniversário sai só como dia e mês — nunca a data completa.
 */
export const getOwnEmployee = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // String literal única: o PostgREST tipa o retorno a partir dela.
    const columns =
      "id, name, email, department, job_title, unit, extension, bio, registration_number, manager_id, co_manager_id, buddy_id, admission_date, birth_date, photo_url, active";

    let { data } = await supabaseAdmin
      .from("employees")
      .select(columns)
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (!data) {
      ({ data } = await supabaseAdmin
        .from("employees")
        .select(columns)
        .eq("id", userId)
        .maybeSingle());
    }
    if (!data) return null;

    const row = data as Record<string, unknown>;
    const birth = row.birth_date ? new Date(`${row.birth_date as string}T00:00:00`) : null;

    return {
      id: row.id as string,
      name: (row.name as string) ?? "",
      email: (row.email as string | null) ?? null,
      department: (row.department as string | null) ?? null,
      job_title: (row.job_title as string | null) ?? null,
      unit: (row.unit as string | null) ?? null,
      extension: (row.extension as string | null) ?? null,
      bio: (row.bio as string | null) ?? null,
      registration_number: (row.registration_number as string | null) ?? null,
      manager_id: (row.manager_id as string | null) ?? null,
      co_manager_id: (row.co_manager_id as string | null) ?? null,
      buddy_id: (row.buddy_id as string | null) ?? null,
      admission_date: (row.admission_date as string | null) ?? null,
      birthday_day: birth ? birth.getDate() : null,
      birthday_month: birth ? birth.getMonth() + 1 : null,
      photo_url: (row.photo_url as string | null) ?? null,
      active: (row.active as boolean) ?? true,
    };
  });

export type OwnEmployee = Awaited<ReturnType<typeof getOwnEmployee>>;
