import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { KeyRound, Loader2, Save } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { updateOwnProfile } from "@/lib/employee.functions";
import { PortalLayout } from "@/components/portal-layout";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";

export const Route = createFileRoute("/_portal/gente-gestao/cadastro")({
  head: () => ({ meta: [{ title: "Meu Perfil — Portal WG" }] }),
  component: CadastroPage,
});

function CadastroPage() {
  const doUpdate = useServerFn(updateOwnProfile);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const profileQuery = useQuery({
    queryKey: ["own-profile"],
    queryFn: async () => {
      const { data: userResp } = await supabase.auth.getUser();
      if (!userResp.user) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("name, email, department, job_title")
        .eq("id", userResp.user.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  useEffect(() => {
    if (profileQuery.data) {
      setName(profileQuery.data.name ?? "");
      setEmail(profileQuery.data.email ?? "");
    }
  }, [profileQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => doUpdate({ data: { name, email } }),
    onSuccess: () => toast.success("Perfil atualizado."),
    onError: (e: Error) => toast.error(e.message),
  });

  const handlePasswordReset = async () => {
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/colaborador/confirmar`,
    });
    if (error) return toast.error(error.message);
    toast.success("E-mail de redefinição de senha enviado.");
  };

  if (profileQuery.isLoading) {
    return (
      <PortalLayout>
        <PageHeader title="Meu Perfil" backTo="/gente-gestao" />
        <div className="max-w-lg space-y-6">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </PortalLayout>
    );
  }

  const profile = profileQuery.data;

  return (
    <PortalLayout>
      <PageHeader title="Meu Perfil" backTo="/gente-gestao" />
      <div className="max-w-lg space-y-6">
        {(profile?.department || profile?.job_title) && (
          <section className="card-soft p-5 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Dados cadastrais</h2>
            {profile.department && (
              <div>
                <span className="text-xs font-semibold text-muted-foreground">Departamento</span>
                <p className="text-sm font-medium mt-0.5">{profile.department}</p>
              </div>
            )}
            {profile.job_title && (
              <div>
                <span className="text-xs font-semibold text-muted-foreground">Cargo</span>
                <p className="text-sm font-medium mt-0.5">{profile.job_title}</p>
              </div>
            )}
          </section>
        )}

        <section className="card-soft p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Informações pessoais</h2>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-input bg-surface px-4 py-2.5 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-input bg-surface px-4 py-2.5 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
            <p className="mt-1 text-xs text-muted-foreground">Ao alterar o e-mail, você receberá uma confirmação no novo endereço.</p>
          </label>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !name.trim() || !email.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </button>
        </section>

        <section className="card-soft p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-secondary">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Alterar senha</h2>
              <p className="text-xs text-muted-foreground">Um link de redefinição será enviado para o seu e-mail.</p>
            </div>
          </div>
          <button
            onClick={handlePasswordReset}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            Enviar link de redefinição
          </button>
        </section>
      </div>
    </PortalLayout>
  );
}
