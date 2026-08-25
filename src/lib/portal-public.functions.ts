import { createServerFn } from "@tanstack/react-start";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Public read endpoints for internal PII tables.
 * RLS restricts anon reads on employees, so the portal fetches them
 * through these server functions using the service role.
 * The portal itself is already gated by the employee access code.
 *
 * Birthdays and anniversaries are now derived from the `employees` table
 * (Single Source of Truth), mapped to shapes compatible with the UI.
 */

export type PortalBirthday = {
  id: string;
  name: string;
  birthday_day: number;
  birthday_month: number;
  role: string | null;
  unit: string | null;
  photo_url: string | null;
  active: boolean;
};

export type PortalAnniversary = {
  id: string;
  name: string;
  admission_date: string;
  role: string | null;
  unit: string | null;
  photo_url: string | null;
  active: boolean;
};

export const listBirthdays = createServerFn({ method: "GET" }).handler(
  async (): Promise<PortalBirthday[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("id, name, birth_date, job_title, department, active")
      .eq("active", true)
      .not("birth_date", "is", null);
    if (error) throw new Error(error.message);

    return (data ?? [])
      .map(e => {
        const [, m, d] = e.birth_date!.split("-");
        return {
          id: e.id,
          name: e.name,
          birthday_month: parseInt(m, 10),
          birthday_day: parseInt(d, 10),
          role: e.job_title,
          unit: e.department,
          photo_url: null as string | null,
          active: e.active,
        };
      })
      .sort((a, b) => a.birthday_month - b.birthday_month || a.birthday_day - b.birthday_day);
  },
);

export const listAnniversaries = createServerFn({ method: "GET" }).handler(
  async (): Promise<PortalAnniversary[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("id, name, admission_date, job_title, department, active")
      .eq("active", true)
      .not("admission_date", "is", null);
    if (error) throw new Error(error.message);

    return (data ?? [])
      .map(e => ({
        id: e.id,
        name: e.name,
        admission_date: e.admission_date!,
        role: e.job_title,
        unit: e.department,
        photo_url: null as string | null,
        active: e.active,
      }))
      .sort((a, b) => a.admission_date.localeCompare(b.admission_date));
  },
);

export const listContacts = createServerFn({ method: "GET" }).handler(
  async (): Promise<Tables<"contacts">[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select("*")
      .eq("active", true)
      .order("order_index");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);
