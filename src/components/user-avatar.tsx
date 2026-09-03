import { cn } from "@/lib/utils";
import { fileUrl } from "@/lib/storage";
import { initialsOf } from "@/hooks/use-current-employee";

export interface UserAvatarProps {
  name: string | null | undefined;
  photoUrl?: string | null;
  /** Lado em px. 34/36/40 no header, 44/48/64 nas listas, 128 no perfil. */
  size?: number;
  /** `ink` = fundo tinta com iniciais verdes (header) · `accent` = o inverso (perfil). */
  tone?: "ink" | "accent" | "muted";
  className?: string;
}

const TONE = {
  ink: "bg-ink text-accent",
  accent: "bg-accent text-ink",
  muted: "bg-surface-muted text-ink",
} as const;

/** Avatar circular com foto do colaborador e iniciais como fallback. */
export function UserAvatar({
  name,
  photoUrl,
  size = 40,
  tone = "ink",
  className,
}: UserAvatarProps) {
  const src = fileUrl(photoUrl);
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full border-[1.5px] border-ink font-black leading-none",
        TONE[tone],
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.32)) }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden style={{ letterSpacing: "-0.02em" }}>
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}
