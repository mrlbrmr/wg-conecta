import { bateritoDb, type BateritoSearchRow } from "./db.server";
import type { BateritoSource } from "./types";

export interface KnowledgeHit {
  /** Origem no portal: 'faq', 'beneficio', 'vaga'… */
  source: string;
  title: string;
  url: string;
  content: string;
  rank: number;
}

/** Trecho por documento enviado ao modelo — o suficiente para responder, sem estufar o prompt. */
const MAX_CHARS = 1200;
const TOP_K = 8;

/**
 * Busca na base de conhecimento — que é o próprio conteúdo publicado do portal.
 * Roda com a service role: a função SQL é `REVOKE`ada de `authenticated`, e a
 * autorização de quem perguntou já foi feita no endpoint.
 */
export async function searchKnowledge(question: string): Promise<KnowledgeHit[]> {
  const db = await bateritoDb();
  const { data, error } = await db.rpc("baterito_search", { q: question, max_rows: TOP_K });
  if (error) throw new Error(`Busca na base falhou: ${error.message}`);

  return ((data ?? []) as BateritoSearchRow[]).map((row) => ({
    source: row.source,
    title: row.title,
    url: row.url,
    content: row.content.slice(0, MAX_CHARS),
    rank: row.rank,
  }));
}

/**
 * Fontes para o bloco "Fonte" da bolha, sem repetir a mesma página duas vezes
 * (uma pergunta sobre férias casa com a FAQ e com a página de férias).
 */
export function sourcesOf(hits: KnowledgeHit[], limit = 2): BateritoSource[] {
  const vistos = new Set<string>();
  const out: BateritoSource[] = [];
  for (const h of hits) {
    if (vistos.has(h.url)) continue;
    vistos.add(h.url);
    out.push({ title: h.title, url: h.url });
    if (out.length === limit) break;
  }
  return out;
}
