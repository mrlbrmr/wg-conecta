/** Documento oficial que embasou a resposta — vira o bloco "Fonte" da bolha. */
export interface BateritoSource {
  title: string;
  /** Rota do portal ou URL externa. */
  url: string;
}

export type BateritoRole = "bot" | "user";

export interface BateritoMessage {
  id: string;
  role: BateritoRole;
  text: string;
  source?: BateritoSource;
  /** Marca a bolha de falha, que ganha a ação "Tentar de novo". */
  failed?: boolean;
}

export interface AskBateritoInput {
  message: string;
  /** Conversa até aqui, sem a pergunta nova. */
  history: BateritoMessage[];
  signal?: AbortSignal;
  /** Chamado a cada pedaço do stream, com o texto acumulado até ali. */
  onDelta?: (partial: string) => void;
}
