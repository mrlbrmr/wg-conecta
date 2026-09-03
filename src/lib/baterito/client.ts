import { supabase } from "@/integrations/supabase/client";
import type { AskBateritoInput, BateritoSource } from "./types";

/** Últimas mensagens enviadas como contexto da conversa. */
const HISTORY_SENT = 6;

/**
 * Único ponto de contato entre a interface e a resposta do assistente.
 *
 * O endpoint devolve SSE: `{type:"text"}` a cada pedaço e um `{type:"done"}`
 * final com as fontes. O `onDelta` vai preenchendo a bolha enquanto o texto
 * chega — o indicador de digitação sai no primeiro pedaço.
 */
export async function askBaterito({
  message,
  history,
  signal,
  onDelta,
}: AskBateritoInput): Promise<{ answer: string; sources: BateritoSource[] }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada");

  const res = await fetch("/api/baterito", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message,
      // O servidor também corta, mas não há razão para a conversa inteira
      // trafegar: só as últimas trocas viram contexto.
      history: history.slice(-HISTORY_SENT).map((m) => ({ role: m.role, text: m.text })),
    }),
  });

  if (!res.ok || !res.body) throw new Error(`Endpoint respondeu ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let sources: BateritoSource[] = [];

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Eventos SSE são separados por linha em branco; o resto fica no buffer.
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      let evt: { type?: string; value?: string; sources?: BateritoSource[] };
      try {
        evt = JSON.parse(line.slice("data: ".length));
      } catch {
        continue;
      }
      if (evt.type === "text" && evt.value) {
        answer += evt.value;
        onDelta?.(answer);
      } else if (evt.type === "done") {
        sources = evt.sources ?? [];
      }
    }
  }

  return { answer, sources };
}
