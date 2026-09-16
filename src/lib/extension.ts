import { z } from "zod";

/** Ramal interno: só dígitos, até 20. Vazio vira `null` (apaga o ramal). */
export const extensionSchema = z
  .string()
  .trim()
  .max(20, "O ramal tem no máximo 20 dígitos.")
  .regex(/^\d*$/, "O ramal aceita só números.")
  .transform((v) => v || null)
  .nullish();
