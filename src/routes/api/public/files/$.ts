import { createFileRoute } from "@tanstack/react-router";

/**
 * Proxy público de arquivos do bucket "portal-public".
 * Como o workspace bloqueia buckets 100% públicos, esta rota entrega
 * o arquivo em nome do servidor. RLS em storage.objects já permite SELECT.
 */
export const Route = createFileRoute("/api/public/files/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat;
        if (!path) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("portal-public").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        const buf = await data.arrayBuffer();
        const ext = path.split(".").pop()?.toLowerCase() ?? "";
        const type =
          ext === "png" ? "image/png" :
          ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
          ext === "webp" ? "image/webp" :
          ext === "svg" ? "image/svg+xml" :
          ext === "gif" ? "image/gif" :
          ext === "pdf" ? "application/pdf" :
          ext === "csv" ? "text/csv" :
          ext === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :
          "application/octet-stream";
        return new Response(buf, {
          headers: {
            "Content-Type": type,
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
