import { createFileRoute } from "@tanstack/react-router";

/**
 * Proxy público de arquivos do bucket "portal-public".
 * Como o workspace bloqueia buckets 100% públicos, esta rota entrega
 * o arquivo em nome do servidor. RLS em storage.objects já permite SELECT.
 *
 * A resposta sai na mesma origem do portal, onde mora a sessão (localStorage).
 * Um SVG com <script> aberto direto aqui rodaria como o portal e levaria o token
 * de quem abriu — e o colaborador consegue gravar em `employee-photos/`. Por isso:
 * - `nosniff` em tudo, para o navegador não "adivinhar" HTML num arquivo qualquer;
 * - CSP `sandbox` em tudo que não é PDF: o documento vira origem opaca, sem script.
 *   Imagem em <img> não é afetada (CSP da resposta só vale quando ela é o documento);
 * - tipo fora da lista é baixado, nunca aberto no navegador.
 */

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

/** Abertos no navegador; o resto vai como download. */
const INLINE = new Set(["png", "jpg", "jpeg", "webp", "avif", "gif", "svg", "pdf"]);

/** O PDF viewer do Chrome não abre em documento com CSP `sandbox`. */
const SANDBOX_CSP = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";

function isSafePath(path: string): boolean {
  if (path.length > 400) return false;
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  return path.split("/").every((seg) => seg !== "" && seg !== "." && seg !== "..");
}

export const Route = createFileRoute("/api/public/files/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat;
        if (!path || !isSafePath(path)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("portal-public").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        const buf = await data.arrayBuffer();

        const ext = path.split(".").pop()?.toLowerCase() ?? "";
        const headers: Record<string, string> = {
          "Content-Type": TYPES[ext] ?? "application/octet-stream",
          "Cache-Control": "public, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        };
        if (ext !== "pdf") headers["Content-Security-Policy"] = SANDBOX_CSP;
        if (!INLINE.has(ext)) {
          // Cabeçalho só aceita Latin-1: nome com acento vai em `filename*` (RFC 5987).
          const name = path.split("/").pop() || "arquivo";
          const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
          headers["Content-Disposition"] =
            `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
        }
        return new Response(buf, { headers });
      },
    },
  },
});
