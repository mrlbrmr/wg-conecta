import { useRef, useState, type ReactNode } from "react";
import {
  Bold,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Video,
  type LucideIcon,
} from "lucide-react";
import { RichText } from "@/components/rich-text";
import { toVideoEmbed } from "@/lib/video-embed";
import { cn } from "@/lib/utils";

/**
 * Editor dos campos `richtext` do painel: textarea com barra de formatação e prévia.
 * Grava Markdown — o mesmo texto que `RichText` mostra no portal.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  required,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [inserting, setInserting] = useState<"link" | "video" | null>(null);

  /** Troca a seleção por `text` e seleciona de `selStart` a `selEnd` (relativos ao início). */
  const replaceSelection = (
    make: (selected: string) => { text: string; sel?: [number, number] },
  ) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const { text, sel } = make(value.slice(start, end));
    onChange(value.slice(0, start) + text + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const [a, b] = sel ?? [text.length, text.length];
      el.setSelectionRange(start + a, start + b);
    });
  };

  const wrap = (mark: string, fallback: string) =>
    replaceSelection((selected) => {
      const inner = selected || fallback;
      return {
        text: `${mark}${inner}${mark}`,
        sel: [mark.length, mark.length + inner.length],
      };
    });

  /** Prefixo em cada linha selecionada (ou na linha do cursor). */
  const prefixLines = (prefix: (i: number) => string) => {
    const el = ref.current;
    if (!el) return;
    const lineStart = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const nextBreak = value.indexOf("\n", el.selectionEnd);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const block = value
      .slice(lineStart, lineEnd)
      .split("\n")
      .map((line, i) => prefix(i) + line)
      .join("\n");
    onChange(value.slice(0, lineStart) + block + value.slice(lineEnd));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(lineStart + block.length, lineStart + block.length);
    });
  };

  /** Bloco próprio, separado por linhas em branco (é o que faz o link virar player). */
  const insertBlock = (block: string) =>
    replaceSelection(() => {
      const el = ref.current!;
      const before = value.slice(0, el.selectionStart);
      const lead =
        before === "" ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
      const text = `${lead}${block}\n\n`;
      return { text };
    });

  const tools: { label: string; Icon: LucideIcon; run: () => void }[] = [
    { label: "Negrito", Icon: Bold, run: () => wrap("**", "texto em negrito") },
    { label: "Itálico", Icon: Italic, run: () => wrap("*", "texto em itálico") },
    { label: "Título", Icon: Heading2, run: () => prefixLines(() => "## ") },
    { label: "Lista", Icon: List, run: () => prefixLines(() => "- ") },
    { label: "Lista numerada", Icon: ListOrdered, run: () => prefixLines((i) => `${i + 1}. `) },
    { label: "Destaque", Icon: Quote, run: () => prefixLines(() => "> ") },
    { label: "Link", Icon: Link2, run: () => setInserting("link") },
    { label: "Vídeo", Icon: Video, run: () => setInserting("video") },
  ];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border-[1.5px] border-ink/25 bg-surface",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        {tools.map(({ label, Icon, run }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            disabled={tab === "preview"}
            onClick={run}
            className="grid h-8 w-8 place-items-center rounded-md text-ink transition-colors hover:bg-accent-soft disabled:opacity-40"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <div className="ml-auto flex gap-1 rounded-full border border-border p-0.5">
          {(["write", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em]",
                tab === t ? "bg-ink text-paper" : "text-muted-foreground hover:text-ink",
              )}
            >
              {t === "write" ? "Escrever" : "Pré-visualizar"}
            </button>
          ))}
        </div>
      </div>

      {inserting && tab === "write" && (
        <InsertBar
          kind={inserting}
          onCancel={() => setInserting(null)}
          onInsert={(url, label) => {
            setInserting(null);
            if (inserting === "video") insertBlock(url);
            else
              replaceSelection((selected) => {
                const text = selected || label || url;
                return { text: `[${text}](${url})` };
              });
          }}
        />
      )}

      {tab === "write" ? (
        <textarea
          ref={ref}
          rows={10}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="block w-full resize-y bg-transparent px-3 py-2.5 font-mono text-[13.5px] leading-[1.65] outline-none"
        />
      ) : (
        <div className="min-h-[180px] px-4 py-3">
          {value.trim() ? (
            <RichText value={value} />
          ) : (
            <p className="text-sm text-muted-foreground">Nada para mostrar ainda.</p>
          )}
        </div>
      )}

      <p className="border-t border-border px-3 py-2 text-[11px] leading-[1.5] text-muted-foreground">
        **negrito** · *itálico* · "- " no começo da linha faz lista. Vídeo: use o botão{" "}
        <Video className="inline h-3 w-3" /> com o link do Google Drive (compartilhado como
        “Qualquer pessoa com o link”) ou do YouTube.
      </p>
    </div>
  );
}

function InsertBar({
  kind,
  onInsert,
  onCancel,
}: {
  kind: "link" | "video";
  onInsert: (url: string, label: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");

  const confirm = () => {
    const clean = url.trim();
    if (kind === "video") {
      if (!toVideoEmbed(clean)) {
        setError("Esse link não é de um vídeo do Google Drive ou do YouTube.");
        return;
      }
    } else if (!/^(https?:\/\/|\/|mailto:)/i.test(clean)) {
      setError("Use um endereço que comece com https://, / ou mailto:.");
      return;
    }
    onInsert(clean, label.trim());
  };

  const field =
    "h-9 min-w-0 rounded-md border-[1.5px] border-ink/25 bg-paper px-2.5 text-sm outline-none focus:border-ink";

  return (
    <div className="flex flex-col gap-2 border-b border-border bg-accent-soft/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirm();
            }
            if (e.key === "Escape") onCancel();
          }}
          placeholder={
            kind === "video"
              ? "https://drive.google.com/file/d/…/view"
              : "https://… ou /gente-gestao/beneficios"
          }
          className={cn(field, "flex-1 basis-64")}
        />
        {kind === "link" && (
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Texto do link (opcional)"
            className={cn(field, "basis-44")}
          />
        )}
        <SmallButton onClick={confirm} primary>
          {kind === "video" ? "Inserir vídeo" : "Inserir link"}
        </SmallButton>
        <SmallButton onClick={onCancel}>Cancelar</SmallButton>
      </div>
      {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
    </div>
  );
}

function SmallButton({
  children,
  onClick,
  primary,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-full border-[1.5px] border-ink px-3.5 text-[12px] font-extrabold",
        primary ? "bg-ink text-paper hover:bg-ink/85" : "bg-surface hover:bg-accent-soft",
      )}
    >
      {children}
    </button>
  );
}
