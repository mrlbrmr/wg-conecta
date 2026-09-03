import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { InkButton, Kicker, PaperCard } from "@/components/paper";
import { UserAvatar } from "@/components/user-avatar";
import { directoryQuery, type DirectoryEntry } from "@/lib/directory-queries";
import { publishRecognition } from "@/lib/portal-write.functions";
import { cn } from "@/lib/utils";
import { PRIVACY_NOTE } from "@/lib/form-defs";

export interface RecognizeColleagueFormProps {
  /** Colaborador logado — não aparece na busca (ninguém reconhece a si mesmo). */
  selfId?: string;
  onPublished?: () => void;
  className?: string;
}

/**
 * Formulário de reconhecimento entre colegas.
 * O nome é um autocomplete sobre o diretório — nunca texto livre.
 */
export function RecognizeColleagueForm({
  selfId,
  onPublished,
  className,
}: RecognizeColleagueFormProps) {
  const qc = useQueryClient();
  const directory = useQuery(directoryQuery);
  const publish = useServerFn(publishRecognition);

  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<DirectoryEntry | null>(null);
  const [message, setMessage] = useState("");

  const matches = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (q.length < 2 || picked) return [];
    return (directory.data ?? [])
      .filter((e) => e.id !== selfId && e.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [term, picked, directory.data, selfId]);

  const mutation = useMutation({
    mutationFn: () => publish({ data: { to_employee_id: picked!.id, message: message.trim() } }),
    onSuccess: () => {
      toast.success("Reconhecimento publicado!");
      setTerm("");
      setPicked(null);
      setMessage("");
      qc.invalidateQueries({ queryKey: ["peer_recognitions"] });
      onPublished?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ready = Boolean(picked) && message.trim().length >= 3;

  return (
    <PaperCard className={cn("p-[26px]", className)}>
      <Kicker>Reconhecer um colega</Kicker>

      <div className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="relative">
          <label className="sr-only" htmlFor="reconhecer-colega">
            Nome do colega
          </label>
          {picked ? (
            <div className="flex items-center gap-3 rounded-lg border-[1.5px] border-ink bg-surface px-3 py-2.5">
              <UserAvatar name={picked.name} photoUrl={picked.photo_url} size={32} tone="muted" />
              <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{picked.name}</span>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground hover:text-ink"
              >
                Trocar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border-[1.5px] border-ink bg-surface px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                id="reconhecer-colega"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Nome do colega"
                autoComplete="off"
                className="w-full bg-transparent py-3 text-[15px] outline-none"
              />
            </div>
          )}

          {matches.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border-[1.5px] border-ink bg-surface shadow-paper">
              {matches.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked(e);
                      setTerm(e.name);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-accent-soft"
                  >
                    <UserAvatar name={e.name} photoUrl={e.photo_url} size={32} tone="muted" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{e.name}</span>
                      {e.job_title && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {e.job_title}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="sr-only" htmlFor="reconhecer-texto">
            O que essa pessoa fez
          </label>
          <textarea
            id="reconhecer-texto"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="O que essa pessoa fez que merece um 'parabéns' de corredor?"
            className="w-full resize-y rounded-lg border-[1.5px] border-ink bg-surface px-3.5 py-3 text-[15px] leading-[1.6] outline-none"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <InkButton disabled={!ready || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Publicando…" : "Publicar ↗"}
        </InkButton>
        <p className="text-xs leading-[1.6] text-muted-foreground">
          Vai pro mural de reconhecimentos e pro perfil da pessoa. {PRIVACY_NOTE}
        </p>
      </div>
    </PaperCard>
  );
}
