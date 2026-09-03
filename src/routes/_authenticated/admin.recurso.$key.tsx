import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { AdminCrud } from "@/components/admin-crud";
import { findResource } from "@/lib/admin-resources";
import { ImportSpreadsheet } from "@/components/import-spreadsheet";
import { CulturaAdmin } from "@/components/cultura-admin";

export const Route = createFileRoute("/_authenticated/admin/recurso/$key")({
  component: () => {
    const { key } = Route.useParams();

    // Aniversários e tempo de casa são a mesma tela, com a aba pré-selecionada
    // pela rota — as duas entradas da sidebar continuam válidas.
    if (key === "aniversariantes") return <CulturaAdmin tab="birth" />;
    if (key === "tempo-de-casa") return <CulturaAdmin tab="tenure" />;

    const res = findResource(key);
    const [importing, setImporting] = useState(false);
    if (!res) return <div>Recurso não encontrado</div>;
    const importable = res.table === "work_anniversaries";
    return (
      <div>
        {importable && (
          <div className="mb-4 flex justify-end">
            <button onClick={() => setImporting(true)} className="inline-flex items-center gap-1.5 rounded-full border border-input bg-surface px-4 py-2 text-sm font-bold hover:bg-secondary">
              <FileSpreadsheet className="h-4 w-4" /> Importar planilha
            </button>
          </div>
        )}
        <AdminCrud resource={res} />
        {importing && importable && (
          <ImportSpreadsheet table={res.table as "birthdays" | "work_anniversaries"} onClose={() => setImporting(false)} />
        )}
      </div>
    );
  },
});
