import { createServerFn } from "@tanstack/react-start";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Public read endpoints for internal PII tables (birthdays, work anniversaries,
 * staff contacts). RLS restricts anon reads on these tables, so the portal
 * fetches them through these server functions using the service role. The
 * portal itself is already gated by the employee access code.
 */

export const listBirthdays = createServerFn({ method: "GET" }).handler(
  async (): Promise<Tables<"birthdays">[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("birthdays")
      .select("*")
      .eq("active", true)
      .order("birthday_month")
      .order("birthday_day");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

export const listAnniversaries = createServerFn({ method: "GET" }).handler(
  async (): Promise<Tables<"work_anniversaries">[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("work_anniversaries")
      .select("*")
      .eq("active", true)
      .order("admission_date");
    if (error) throw new Error(error.message);
    return data ?? [];
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
