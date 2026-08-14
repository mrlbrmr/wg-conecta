/**
 * Cliente-side helpers para o "código de acesso WG" do colaborador.
 * A validação real acontece via server function; o cliente apenas
 * lembra localmente que o acesso foi liberado.
 */
const KEY = "wg_access_ok";

export function isAccessGranted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function grantAccess() {
  try { window.localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
}

export function revokeAccess() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}
