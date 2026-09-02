import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  fetchDirectory,
  birthdaysOf,
  anniversariesOf,
  type DirectoryEntry,
} from "@/lib/directory-queries";

export type PortalSettings = Tables<"portal_settings">;
export type QuickLink = Tables<"quick_links">;
export type Announcement = Tables<"announcements">;
export type Benefit = Tables<"benefits">;
export type DocumentRow = Tables<"documents">;
export type FaqItem = Tables<"faq_items">;
export type InternalJob = Tables<"internal_jobs">;
export type OnboardingMaterial = Tables<"onboarding_materials">;
export type FormRow = Tables<"forms">;
// Aniversariantes e tempo de casa derivam de `employees` (SSoT), lidos pela
// view `employee_directory` — sem service role e sem campo sensível.
export type Birthday = DirectoryEntry;
export type WorkAnniversary = DirectoryEntry;
export type Recognition = Tables<"recognitions">;
export type Campaign = Tables<"campaigns">;
export type Contact = Tables<"contacts">;
export type GgPage = Tables<"gg_pages">;

function ensure<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  if (res.data == null) throw new Error("Sem dados");
  return res.data;
}
function ensureList<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

export const portalSettingsQuery = queryOptions({
  queryKey: ["portal_settings"],
  queryFn: async (): Promise<PortalSettings | null> => {
    const r = await supabase
      .from("portal_settings")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();
    if (r.error) throw new Error(r.error.message);
    return r.data;
  },
});

export const quickLinksQuery = queryOptions({
  queryKey: ["quick_links"],
  queryFn: async (): Promise<QuickLink[]> =>
    ensureList(
      await supabase.from("quick_links").select("*").eq("active", true).order("order_index"),
    ),
});

export const activeAnnouncementsQuery = queryOptions({
  queryKey: ["announcements", "active"],
  queryFn: async (): Promise<Announcement[]> => {
    const nowIso = new Date().toISOString();
    return ensureList(
      await supabase
        .from("announcements")
        .select("*")
        .eq("status", "publicado")
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order("pinned", { ascending: false })
        .order("published_at", { ascending: false }),
    );
  },
});

export const archivedAnnouncementsQuery = queryOptions({
  queryKey: ["announcements", "archive"],
  queryFn: async (): Promise<Announcement[]> =>
    ensureList(
      await supabase
        .from("announcements")
        .select("*")
        .in("status", ["publicado", "arquivado"])
        .order("published_at", { ascending: false }),
    ),
});

export function announcementByIdQuery(id: string) {
  return queryOptions({
    queryKey: ["announcement", id],
    queryFn: async (): Promise<Announcement> =>
      ensure(await supabase.from("announcements").select("*").eq("id", id).maybeSingle()),
  });
}

export const benefitsQuery = queryOptions({
  queryKey: ["benefits"],
  queryFn: async (): Promise<Benefit[]> =>
    ensureList(await supabase.from("benefits").select("*").eq("active", true).order("order_index")),
});

export const documentsQuery = queryOptions({
  queryKey: ["documents"],
  queryFn: async (): Promise<DocumentRow[]> =>
    ensureList(
      await supabase
        .from("documents")
        .select("*")
        .eq("active", true)
        .order("published_at", { ascending: false }),
    ),
});

export const faqQuery = queryOptions({
  queryKey: ["faq_items"],
  queryFn: async (): Promise<FaqItem[]> =>
    ensureList(
      await supabase.from("faq_items").select("*").eq("active", true).order("order_index"),
    ),
});

export const jobsQuery = queryOptions({
  queryKey: ["internal_jobs"],
  queryFn: async (): Promise<InternalJob[]> =>
    ensureList(
      await supabase
        .from("internal_jobs")
        .select("*")
        .neq("status", "encerrada")
        .order("order_index"),
    ),
});

export const onboardingQuery = queryOptions({
  queryKey: ["onboarding"],
  queryFn: async (): Promise<OnboardingMaterial[]> =>
    ensureList(
      await supabase
        .from("onboarding_materials")
        .select("*")
        .eq("active", true)
        .order("order_index"),
    ),
});

export const formsQuery = queryOptions({
  queryKey: ["forms"],
  queryFn: async (): Promise<FormRow[]> =>
    ensureList(await supabase.from("forms").select("*").eq("active", true).order("order_index")),
});

export const birthdaysQuery = queryOptions({
  queryKey: ["employee_directory", "birthdays"],
  queryFn: async (): Promise<DirectoryEntry[]> => birthdaysOf(await fetchDirectory()),
  staleTime: 5 * 60 * 1000,
});

export const anniversariesQuery = queryOptions({
  queryKey: ["employee_directory", "anniversaries"],
  queryFn: async (): Promise<DirectoryEntry[]> => anniversariesOf(await fetchDirectory()),
  staleTime: 5 * 60 * 1000,
});

export const recognitionsQuery = queryOptions({
  queryKey: ["recognitions"],
  queryFn: async (): Promise<Recognition[]> =>
    ensureList(
      await supabase
        .from("recognitions")
        .select("*")
        .eq("active", true)
        .order("recognition_date", { ascending: false }),
    ),
});

export const campaignsQuery = queryOptions({
  queryKey: ["campaigns"],
  queryFn: async (): Promise<Campaign[]> =>
    ensureList(
      await supabase
        .from("campaigns")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false }),
    ),
});

export const contactsQuery = queryOptions({
  queryKey: ["contacts"],
  queryFn: async (): Promise<Contact[]> =>
    ensureList(await supabase.from("contacts").select("*").eq("active", true).order("order_index")),
});

export const ggPagesQuery = queryOptions({
  queryKey: ["gg_pages"],
  queryFn: async (): Promise<GgPage[]> =>
    ensureList(await supabase.from("gg_pages").select("*").eq("active", true)),
});

export function ggPageQuery(key: string) {
  return queryOptions({
    queryKey: ["gg_pages", key],
    queryFn: async (): Promise<GgPage | null> => {
      const r = await supabase.from("gg_pages").select("*").eq("page_key", key).maybeSingle();
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },
  });
}
