import { supabase } from "@/integrations/supabase/client";

const FORBIDDEN_EXT = new Set(["exe", "bat", "cmd", "com", "scr", "msi", "sh", "ps1", "vbs", "js"]);

export function fileUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const clean = path.replace(/^\/+/, "");
  return `/api/public/files/${clean}`;
}

/**
 * Foto do próprio colaborador.
 * O caminho é fixo — `employee-photos/<id>.<ext>` — porque a policy de storage
 * só deixa o colaborador escrever num arquivo com o próprio id no nome.
 */
export async function uploadEmployeePhoto(file: File, employeeId: string): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!["jpg", "jpeg", "png", "webp", "avif"].includes(ext)) {
    throw new Error("Envie a foto em JPG, PNG, WEBP ou AVIF.");
  }
  const path = `employee-photos/${employeeId}.${ext}`;
  const { error } = await supabase.storage.from("portal-public").upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function uploadFile(file: File, folder: string): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (FORBIDDEN_EXT.has(ext)) throw new Error("Tipo de arquivo não permitido.");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("portal-public").upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);
  return path;
}

/** Limite do anexo de solicitação — o mesmo número que a tela promete. */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"] as const;

/**
 * Anexo de uma solicitação de G&G.
 *
 * Vai para `request-attachments`, bucket privado — atestado e comprovante não
 * podem cair no `portal-public`, que é servido sem autenticação por
 * `/api/public/files`. A policy de storage só aceita escrita dentro da pasta do
 * próprio colaborador, por isso o caminho começa pelo id dele. A leitura sai por
 * URL assinada (`getRequestAttachmentUrl`).
 */
export async function uploadRequestAttachment(file: File, employeeId: string): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!(ATTACHMENT_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new Error("O anexo precisa ser PDF, JPG ou PNG.");
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    throw new Error("O anexo passa de 10 MB. Comprime ou manda por e-mail?");
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${employeeId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("request-attachments").upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);
  return path;
}
