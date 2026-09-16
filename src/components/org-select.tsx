import { DEPARTMENTS, UNITS } from "@/lib/org";

/**
 * Setor ou filial escolhidos na lista oficial (`src/lib/org.ts`).
 *
 * Valor antigo fora da lista continua como opção, marcado, para que abrir e salvar o
 * cadastro não apague o dado sem querer. Trocando, ele some da lista.
 */
export function OrgSelect({
  kind,
  value,
  onChange,
  className,
  id,
}: {
  kind: "department" | "unit";
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
}) {
  const options: readonly string[] = kind === "department" ? DEPARTMENTS : UNITS;
  const legacy = value && !options.includes(value) ? value : null;

  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="">{kind === "department" ? "Sem setor definido" : "Sem filial definida"}</option>
      {legacy && <option value={legacy}>{legacy} (fora da lista)</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
