/**
 * Vídeo embutido nos textos do portal (FAQ, atalhos, comunicados, páginas do G&G).
 *
 * Só dois serviços viram player: Google Drive e YouTube. Qualquer outro endereço continua sendo
 * um link comum — o `iframe` nunca recebe uma URL digitada, só a montada aqui a partir do id.
 */

const DRIVE_ID = /^[\w-]{10,}$/;
const YOUTUBE_ID = /^[\w-]{11}$/;

export type VideoEmbed = { provider: "drive" | "youtube"; src: string };

export function toVideoEmbed(raw: string): VideoEmbed | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "drive.google.com") {
    // drive.google.com/file/d/<id>/view · /preview · /edit
    const file = url.pathname.match(/^\/file\/d\/([^/]+)/)?.[1];
    // drive.google.com/open?id=<id> · /uc?id=<id>
    const id = file ?? url.searchParams.get("id") ?? "";
    return DRIVE_ID.test(id)
      ? { provider: "drive", src: `https://drive.google.com/file/d/${id}/preview` }
      : null;
  }

  let ytId = "";
  if (host === "youtu.be") ytId = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") ytId = url.searchParams.get("v") ?? "";
    else ytId = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? "";
  }
  return YOUTUBE_ID.test(ytId)
    ? { provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${ytId}` }
    : null;
}
