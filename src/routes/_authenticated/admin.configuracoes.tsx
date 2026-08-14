import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Save, Upload } from "lucide-react";
import { portalSettingsQuery, type PortalSettings } from "@/lib/portal-queries";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile, fileUrl } from "@/lib/storage";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Portal WG" }] }),
  component: ConfigPage,
});

function ConfigPage() {
  const qc = useQueryClient();
  const q = useQuery(portalSettingsQuery);
  const [form, setForm] = useState<Partial<PortalSettings>>({});
  const [uploading, setUploading] = useState(false);

  useEffect(() => { if (q.data) setForm(q.data); }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("portal_settings").update({
        portal_name: form.portal_name, welcome_text: form.welcome_text,
        logo_url: form.logo_url, primary_color: form.primary_color,
        privacy_notice: form.privacy_notice, gg_contact_text: form.gg_contact_text,
        footer_message: form.footer_message,
      }).eq("singleton", true);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Configurações salvas."); qc.invalidateQueries({ queryKey: ["portal_settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Configurações gerais</h1>
        <p className="text-sm text-muted-foreground">Personalize o Portal do Colaborador.</p>
      </div>

      <section className="card-soft p-6 space-y-4">
        <h2 className="font-bold">Identidade do portal</h2>
        <Field label="Nome do portal">
          <input value={form.portal_name ?? ""} onChange={(e) => setForm(s => ({ ...s, portal_name: e.target.value }))} className={inp} />
        </Field>
        <Field label="Texto de boas-vindas">
          <textarea rows={2} value={form.welcome_text ?? ""} onChange={(e) => setForm(s => ({ ...s, welcome_text: e.target.value }))} className={inp} />
        </Field>
        <Field label="Logo">
          {form.logo_url && <img src={fileUrl(form.logo_url) ?? ""} alt="logo" className="h-16 w-16 rounded-2xl object-cover border border-border mb-2" />}
          <label className="inline-flex items-center gap-2 rounded-xl border border-dashed border-input px-4 py-2.5 text-sm font-semibold cursor-pointer hover:bg-secondary">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Trocar logo
            <input type="file" hidden accept="image/*" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return; setUploading(true);
              try { const path = await uploadFile(f, "settings"); setForm(s => ({ ...s, logo_url: path })); }
              catch (err) { toast.error((err as Error).message); } finally { setUploading(false); e.target.value = ""; }
            }} />
          </label>
        </Field>
        <Field label="Cor principal (hex)">
          <input value={form.primary_color ?? ""} onChange={(e) => setForm(s => ({ ...s, primary_color: e.target.value }))} className={inp} />
        </Field>
      </section>

      <section className="card-soft p-6 space-y-4">
        <h2 className="font-bold">Textos</h2>
        <Field label="Contato de Gente & Gestão">
          <input value={form.gg_contact_text ?? ""} onChange={(e) => setForm(s => ({ ...s, gg_contact_text: e.target.value }))} className={inp} />
        </Field>
        <Field label="Aviso de privacidade">
          <textarea rows={3} value={form.privacy_notice ?? ""} onChange={(e) => setForm(s => ({ ...s, privacy_notice: e.target.value }))} className={inp} />
        </Field>
        <Field label="Mensagem do rodapé">
          <input value={form.footer_message ?? ""} onChange={(e) => setForm(s => ({ ...s, footer_message: e.target.value }))} className={inp} />
        </Field>
      </section>

      <div>
        <button onClick={() => save.mutate()} disabled={save.isPending} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar configurações
        </button>
      </div>

    </div>
  );
}

const inp = "w-full rounded-xl border border-input bg-surface px-4 py-2.5 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span><div className="mt-1.5">{children}</div></label>;
}
