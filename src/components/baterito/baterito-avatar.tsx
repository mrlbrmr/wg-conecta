import { cn } from "@/lib/utils";

export const BATERITO_IMG = "/baterito.png";

interface BateritoAvatarProps {
  /** Lado do quadro, em px. */
  size: number;
  /** Lado da imagem do mascote dentro do quadro, em px. */
  image: number;
  className?: string;
  /** Balanço do "andando" enquanto o assistente pensa. */
  stepping?: boolean;
}

/**
 * Mascote dentro do quadro arredondado. Sempre decorativo: onde ele aparece, o
 * nome do assistente já está escrito ao lado ou na própria bolha.
 * O Baterito "pisa" na borda de baixo — daí `contain` + `object-bottom`.
 */
export function BateritoAvatar({ size, image, className, stepping = false }: BateritoAvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center justify-center overflow-hidden border-[1.5px] border-ink",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={BATERITO_IMG}
        alt=""
        aria-hidden
        className={cn("object-contain object-bottom", stepping && "animate-bat-step")}
        style={{ width: image, height: image }}
      />
    </span>
  );
}
