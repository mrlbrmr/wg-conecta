-- Setor "Gestão de Pessoas" passa a se chamar "Gente & Gestão"
--
-- A lista oficial de setores (`src/lib/org.ts`) trocou o nome. Esta migration troca o nome
-- também no que já está gravado: cadastro de colaboradores, matriz de contatos e o campo
-- "setor" dos envios do SIM (para o filtro do painel continuar achando os antigos).
--
-- Idempotente: rodar de novo não acha mais nada.

UPDATE public.employees
   SET department = 'Gente & Gestão',
       updated_at = now()
 WHERE department = 'Gestão de Pessoas';

UPDATE public.contact_matrix
   SET department = 'Gente & Gestão'
 WHERE department = 'Gestão de Pessoas';

UPDATE public.channel_submissions
   SET payload = jsonb_set(payload, '{sector}', '"Gente & Gestão"')
 WHERE payload->>'sector' = 'Gestão de Pessoas';
