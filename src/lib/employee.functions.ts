import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SITE_URL = (process.env.SITE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const CONFIRM_URL = `${SITE_URL}/colaborador/confirmar`;

const emailSchema = z.string().email();

export const inviteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      name: z.string().min(2).max(120),
      email: emailSchema,
      department: z.string().max(120).optional(),
      job_title: z.string().max(120).optional(),
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
      name: data.name,
      email: data.email,
      department: data.department ?? null,
      job_title: data.job_title ?? null,
      phone: data.phone ?? null,
      birth_date: data.birth_date ?? null,
      admission_date: data.admission_date ?? null,
      invited_at: new Date().toISOString(),
    });
    if (dbError) throw new Error(dbError.message);
    return { ok: true, id: invited.user.id };
  });

export const resendEmployeeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ employeeId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emp, error: fetchErr } = await supabaseAdmin
      .from("employees")
      .select("email")
      .eq("id", data.employeeId)
      .single();
    if (fetchErr || !emp) throw new Error("Colaborador não encontrado.");
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(emp.email, {
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
  .middleware([requireSupabaseAuth])
  .validator(z.object({ email: emailSchema }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
      options: { redirectTo: CONFIRM_URL },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      name: z.string().min(2).max(120).optional(),
      email: emailSchema.optional(),
      department: z.string().max(120).nullish(),
      job_title: z.string().max(120).nullish(),
      phone: z.string().max(30).nullish(),
      birth_date: z.string().nullish(),
      admission_date: z.string().nullish(),
      active: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authPatch: { email?: string; ban_duration?: string } = {};
    if (data.email) authPatch.email = data.email;
    if (data.active === false) authPatch.ban_duration = "876600h";
    if (data.active === true) authPatch.ban_duration = "none";
    if (Object.keys(authPatch).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, authPatch);
      if (error) throw new Error(error.message);
    }
    const patch = {
      updated_at: new Date().toISOString(),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.department !== undefined && { department: data.department }),
      ...(data.job_title !== undefined && { job_title: data.job_title }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.birth_date !== undefined && { birth_date: data.birth_date }),
      ...(data.admission_date !== undefined && { admission_date: data.admission_date }),
      ...(data.active !== undefined && { active: data.active }),
    };
    const { error } = await supabaseAdmin.from("employees").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("id, name, email, department, job_title, phone, birth_date, admission_date, active, invited_at, created_at")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateOwnProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      name: z.string().min(2).max(120),
      email: emailSchema,
    }),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.email) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: data.email });
      if (error) throw new Error(error.message);
    }
    const { error } = await supabaseAdmin
      .from("employees")
      .update({ name: data.name, email: data.email, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
