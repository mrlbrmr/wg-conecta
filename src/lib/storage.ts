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
