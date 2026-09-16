import type { ComponentProps, ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { toVideoEmbed } from "@/lib/video-embed";
import { cn } from "@/lib/utils";

/**
 * Texto formatado dos conteúdos do G&G (FAQ, atalhos, comunicados, páginas).
 *
 * O texto é Markdown: **negrito**, *itálico*, listas, títulos e links. Uma linha que tem só um
 * link do Google Drive ou do YouTube vira player. HTML digitado não é interpretado — aparece
 * como texto —, então nada do que se escreve no painel roda como código na página.
 *
 * Texto antigo, sem marcação, continua igual: cada quebra de linha vira quebra de linha.
 */
export function RichText({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  if (!value?.trim()) return null;
  return (
    <div className={cn("flex flex-col gap-3 text-[15px] leading-[1.7] text-pretty", className)}>
      <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} components={COMPONENTS}>
        {value}
      </Markdown>
    </div>
  );
}

type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

/** O link sozinho no parágrafo, se houver — é o que vira vídeo. */
function loneLink(node: HastNode | undefined): string | null {
  const kids = (node?.children ?? []).filter((c) => !(c.type === "text" && !c.value?.trim()));
  if (kids.length !== 1 || kids[0].tagName !== "a") return null;
  const href = kids[0].properties?.href;
  return typeof href === "string" ? href : null;
}

export function VideoFrame({ src, title }: { src: string; title?: string }) {
  return (
    <div className="relative my-1 aspect-video w-full overflow-hidden rounded-lg border-[1.5px] border-ink bg-ink">
      <iframe
        src={src}
        title={title ?? "Vídeo"}
        loading="lazy"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}

function Paragraph({ node, children }: ComponentProps<"p"> & { node?: HastNode }) {
  const href = loneLink(node);
  const video = href ? toVideoEmbed(href) : null;
  if (video) return <VideoFrame src={video.src} />;
  return <p>{children}</p>;
}

function Anchor({ href = "", children }: ComponentProps<"a">) {
  const internal = href.startsWith("/") && !href.startsWith("//");
  return (
    <a
      href={href}
      {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      className="font-bold text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
    >
      {children}
    </a>
  );
}

const heading = (Tag: "h2" | "h3" | "h4", size: string) =>
  function Heading({ children }: { children?: ReactNode }) {
    return (
      <Tag className={cn("mt-2 font-black tracking-[-0.02em] text-ink", size)}>{children}</Tag>
    );
  };

const COMPONENTS: Components = {
  p: Paragraph as Components["p"],
  a: Anchor,
  // Título do texto nunca compete com o título da página.
  h1: heading("h2", "text-[22px] leading-tight"),
  h2: heading("h3", "text-[19px] leading-tight"),
  h3: heading("h4", "text-[16px]"),
  h4: heading("h4", "text-[15px]"),
  h5: heading("h4", "text-[15px]"),
  h6: heading("h4", "text-[15px]"),
  ul: ({ children }) => <ul className="flex list-disc flex-col gap-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="flex list-decimal flex-col gap-1 pl-6">{children}</ol>,
  li: ({ children }) => <li className="pl-1 marker:text-primary">{children}</li>,
  strong: ({ children }) => <strong className="font-extrabold text-ink">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-[3px] border-primary pl-4 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-2 border-border" />,
  code: ({ children }) => (
    <code className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b-[1.5px] border-ink px-3 py-2 font-extrabold">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-border px-3 py-2">{children}</td>,
  // Imagem por link externo fica como link: imagens entram pelo campo de imagem do painel.
  img: ({ src, alt }) => (
    <Anchor href={typeof src === "string" ? src : ""}>{alt || "Imagem"}</Anchor>
  ),
};
