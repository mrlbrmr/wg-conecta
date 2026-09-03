import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { setAnnouncementRead } from "@/lib/portal-write.functions";
import { cn } from "@/lib/utils";

export interface ReadToggleProps {
  announcementId: string;
  read: boolean;
  className?: string;
}

/** Alterna o estado de leitura de um comunicado. O contador do topo reage junto. */
export function ReadToggle({ announcementId, read, className }: ReadToggleProps) {
  const qc = useQueryClient();
  const setRead = useServerFn(setAnnouncementRead);

  const mutation = useMutation({
    mutationFn: () => setRead({ data: { announcement_id: announcementId, read: !read } }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["announcement_reads"] }),
  });

  return (
    <button
      type="button"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      className={cn(
        "text-[11px] font-extrabold uppercase tracking-[0.12em] transition-colors disabled:opacity-50",
        read ? "text-primary" : "text-muted-foreground hover:text-ink",
        className,
      )}
    >
      {read ? "Lido ✓" : "Marcar como lido"}
    </button>
  );
}
