-- Filial e Setor do Portal do Colaborador
-- Gerado de "Empregados.xlsx" (abas Empregados e PJ), somente colaboradores ATIVOS.
-- 135 colaboradores.
--
-- Contexto: até aqui a coluna `department` guardava a FILIAL — a importação de
-- planilha mapeava "Filial" para ela e o formulário do admin chamava o campo de
-- "Filial / Departamento". Agora são duas coisas separadas:
--
--   unit       = Filial  (SJP, RJ, SP, LDA, MGÁ, SBC, SUM)
--   department = Setor   (Varejo, Comercial Externo, Gente & Gestão…)
--
-- Pré-requisito: migration 20260903120100 (que cria `unit`) aplicada.
-- Rode na ordem. O BLOCO 1 só confere.

CREATE OR REPLACE FUNCTION pg_temp.wg_norm(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT btrim(regexp_replace(
    lower(translate(t, 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '\s+', ' ', 'g'))
$fn$;

DROP TABLE IF EXISTS wg_lotacao;
CREATE TEMP TABLE wg_lotacao (colaborador text, filial text, setor text);
INSERT INTO wg_lotacao (colaborador, filial, setor) VALUES
  ('ELISANGELA DA SILVA PALAGI', 'LDA', 'Varejo'),
  ('HENRIQUE ARAÚJO', 'LDA', 'Varejo'),
  ('FERNANDO NATA MORAES LIMA', 'MGÁ', 'Logística'),
  ('GUILHERME BRILHANTE FELIZATE', 'MGÁ', 'Logística'),
  ('MARCELO COUTINHO MUNIZ', 'MGÁ', 'Logística'),
  ('MICHAEL LUCIANO MONTREZOL DE SOUZA', 'MGÁ', 'Logística'),
  ('EDUARDO CALOI ACORSI', 'MGÁ', 'Comercial Externo'),
  ('KARINA ADRIAN DA SILVA', 'MGÁ', 'Administrativo'),
  ('VICTOR RIBEIRO MENDES PALHANO', 'MGÁ', 'Comercial Externo'),
  ('WINICIUS NAFTALI DE OLIVEIRA', 'MGÁ', 'Logística'),
  ('ELDERI VASCO FELIX', 'MGÁ', 'Logística'),
  ('MARCOS ANTÔNIO DE ALMEIDA', 'MGÁ', 'Logística'),
  ('THIAGO GABRIEL MONTREZOL BOHRER', 'MGÁ', 'Logística'),
  ('ADRIANO DOS REIS RODRIGUES MIRANDA', 'RJ', 'Logística'),
  ('FERNANDO DE ALBUQUERQUE FERREIRA', 'RJ', 'Logística'),
  ('GABRIEL DE CERQUEIRA ROCHA', 'RJ', 'Logística'),
  ('JOSE ANDERSON GRACILIANO TENORIO', 'RJ', 'Logística'),
  ('ROBSON LEMES DE SA', 'RJ', 'Logística'),
  ('RODRIGO DE LIMA', 'RJ', 'Logística'),
  ('SEBASTIÃO CARLOS GRILLO DA SILVA', 'RJ', 'Logística'),
  ('VITOR DA SILVA SOARES', 'RJ', 'Logística'),
  ('WAGNER APARECIDA GOMES', 'RJ', 'Logística'),
  ('YURI LISBOA DOS SANTOS', 'RJ', 'Logística'),
  ('ADRIANO FERREIRA SILVA', 'RJ', 'Comercial Externo'),
  ('ALESSANDRA MAXIMO DE OLIVEIRA MACHADO', 'RJ', 'Administrativo'),
  ('ATILA SOARES LIMA', 'RJ', 'Logística'),
  ('BEATRIZ DOS SANTOS ROSA', 'RJ', 'Administrativo'),
  ('EDNEI SANTOS DA SILVA', 'RJ', 'Logística'),
  ('ISRAEL BASTOS DA SILVA', 'RJ', 'Comercial Externo'),
  ('JULIO CESAR GOMES TEIXEIRA', 'RJ', 'Logística'),
  ('JULIO CEZAR ALEXANDRE ADÃO RODRIGUES DA SILVA COSTA', 'RJ', 'Logística'),
  ('LUAN HENRIQUE NASCIMENTO DE ASSIS', 'RJ', 'Logística'),
  ('MARCIO OLIVEIRA DOS SANTOS', 'RJ', 'Logística'),
  ('ROBERTO CARLOS ANDRE', 'RJ', 'Comercial Externo'),
  ('RUI DA SILVA SANT ANA', 'RJ', 'Comercial Externo'),
  ('SIMONE PAULINO DE SOUZA GARCIA', 'RJ', 'Administrativo'),
  ('TIAGO ANTONIO DA ROCHA', 'RJ', 'Comercial Externo'),
  ('WEVERTON NINA MACIEIRA', 'RJ', 'Logística'),
  ('RONALD DOS SANTOS', 'RJ', 'Logística'),
  ('DERLANIO SANTOS SILVA', 'SBC', 'Varejo'),
  ('LEANDRO MIRIANI', 'SBC', 'Varejo'),
  ('ANDRE LOURENCO', 'SJP', 'Logística'),
  ('DIEGO GOUVEIA DOS SANTOS', 'SJP', 'Logística'),
  ('FERNANDO FERREIRA NOVAES', 'SJP', 'Logística'),
  ('ALISSON DE BARROS NARLOCH', 'SJP', 'Marketing'),
  ('AMANDA VITORIA DA SILVA ROSA', 'SJP', 'Trade'),
  ('GUSTAVO SEBASTIAO FERREIRA', 'SJP', 'Logística'),
  ('ANDRE LUIS MATUCHESKI TOZO', 'SJP', 'Logística'),
  ('ANDREIA BATISTA CAJU STRAMBECK', 'SJP', 'Comercial Interno'),
  ('ARMANDO DE ANDRADE DE RIBEIRO', 'SJP', 'Comercial Externo'),
  ('BIANKA BANQUES RODRIGUES SILVA', 'SJP', 'Financeiro'),
  ('CELIO DE BRITTO', 'SJP', 'Comercial Externo'),
  ('DANIELLA MIRAVALHES FERNANDES', 'SJP', 'Trade'),
  ('DARLENE DA SILVA ANDRADE', 'SJP', 'Serviços Gerais'),
  ('RAFAEL FONTES CORREIA', 'SJP', 'Logística'),
  ('EDUARDA CAROLINE SCHMIDT', 'SJP', 'Controladoria'),
  ('FELIPE SANTOS DE CRISTO', 'SJP', 'Logística'),
  ('TIAGO DOS SANTOS PEREIRA', 'SJP', 'Logística'),
  ('GABRIEL HENRIQUE DE ANDRADE', 'SJP', 'Comercial Externo'),
  ('GUILHERME LAWIN INGLES', 'SJP', 'Comercial Externo'),
  ('ISABELLY PRADO DOS SANTOS', 'SJP', 'Financeiro'),
  ('JENIFER DE OLIVEIRA', 'SJP', 'Financeiro'),
  ('JESSIANE LARA ALVES', 'SJP', 'Comercial Interno'),
  ('JESSICA MEDEIROS DA SILVA', 'SJP', 'CWG'),
  ('JOSE WILLIAN BENVINDO DA SILVA', 'SJP', 'Comercial Interno'),
  ('JULIANA OLENICK DE SOUZA TEIXEIRA', 'SJP', 'Financeiro'),
  ('JULLIANA PACHECO DA ROCHA', 'SJP', 'Gente & Gestão'),
  ('JULYENY VICTÓRIA MOURA CARVALHO', 'SJP', 'Comercial Interno'),
  ('KADYJA GEOVANA SILVA SANTOS', 'SJP', 'Financeiro'),
  ('KAMILA RODRIGUES DA SILVA', 'SJP', 'Comercial Interno'),
  ('KEITY MAHARA OLIVEIRA DE GODOY DA COSTA', 'SJP', 'Financeiro'),
  ('LARA DOMINGUES SILVA', 'SJP', 'Financeiro'),
  ('LEONARDO SETIM CORDEIRO DA CRUZ', 'SJP', 'Logística'),
  ('MARIA EDUARDA DA SILVA SANTOS', 'SJP', 'Controladoria'),
  ('MARIA EDUARDA FERREIRA', 'SJP', 'Financeiro'),
  ('MURILO BREMER TIERA', 'SJP', 'Gente & Gestão'),
  ('NICOLAS NICOLIO CAMARA', 'SJP', 'CWG'),
  ('PAULO ROBERTO BELARMINO SCACHETTI', 'SJP', 'Logística'),
  ('RHADASSA SOUZA DA SILVEIRA', 'SJP', 'Controladoria'),
  ('ROBERT DA SILVA ROSA', 'SJP', 'Logística'),
  ('SARA PEREIRA ROCHA', 'SJP', 'Financeiro'),
  ('STHEFANY OLIVEIRA DA ROCHA CORREIA', 'SJP', 'Comercial Interno'),
  ('THALIA HALINE DE LIMA', 'SJP', 'Comercial Interno'),
  ('THIAGO DIAS EVANGELISTA', 'SJP', 'Trade'),
  ('WELLINGTON SANTANA DE MIRANDA', 'SJP', 'T.I'),
  ('YASMIN KAEHLER', 'SJP', 'Gente & Gestão'),
  ('CAROLINE ALVES DA SILVA', 'SJP', 'Financeiro'),
  ('MAIARA APARECIDA CANDIDO', 'SJP', 'Financeiro'),
  ('NICOLE SCHMIDT DE MORAIS', 'SJP', 'Trade'),
  ('ALESSANDRA ESCUDERO AVILA PERES', 'SP', 'Administrativo'),
  ('CLAUDIO RENE FERREIRA DOS SANTOS', 'SP', 'Logística'),
  ('EDUARDO DA COSTA', 'SP', 'Comercial Externo'),
  ('EDUARDO SQUETINI DE CAMPOS', 'SP', 'Comercial Externo'),
  ('FERNANDO ZAMPERLIN DA COSTA', 'SP', 'Comercial Externo'),
  ('GABRIEL HENRIQUE DE ANGELIS ARCARI', 'SP', 'Logística'),
  ('LUIZ FELIPE CARDOSO PEREIRA', 'SP', 'Comercial Externo'),
  ('MARCOS BARBOSA DA SILVA', 'SP', 'Logística'),
  ('PAULO HENRIQUE DOS SANTOS', 'SP', 'Varejo'),
  ('RAFAELA BARBOSA DE LIMA', 'SP', 'Administrativo'),
  ('RIQUELME LOPES DOS SANTOS', 'SP', 'Logística'),
  ('RODOLFO DA SILVA NAUMANN', 'SP', 'Comercial Externo'),
  ('RODRIGO SOARES DE OLIVEIRA', 'SP', 'Logística'),
  ('SONIA MARIA SILVA PEREIRA', 'SP', 'Serviços Gerais'),
  ('VICTOR GRIENO NUNES DE LIMA', 'SP', 'Logística'),
  ('ANTONIO CARLOS SANTOS MARQUES', 'SP', 'Logística'),
  ('EDILSON ALEIXO DE OLIVEIRA', 'SP', 'Logística'),
  ('ELIVELTON SANTANA SANTOS', 'SP', 'Logística'),
  ('GABRIEL FERREIRA DOS SANTOS', 'SP', 'Logística'),
  ('GERSON CORREIA NUNES DA SILVA', 'SP', 'Logística'),
  ('GLEISON MARTINS DOS SANTOS', 'SP', 'Logística'),
  ('JONATAS DOS SANTOS SILVA', 'SP', 'Logística'),
  ('JOSE NILSON HONORATO DIAS', 'SP', 'Logística'),
  ('LERCIO DEYVID DA SILVA BARBOSA', 'SP', 'Logística'),
  ('MARITON JOSÉ DA SILVA SANTOS JUNIOR', 'SP', 'Logística'),
  ('JULIANA CRISTINE BRANDÃO DA SILVA', 'SP', 'Administrativo'),
  ('DAYANE IVANOVSKI BUENO', 'SUM', 'Administrativo'),
  ('JESSICA GLAUCIA BASTOS', 'SUM', 'Comercial Externo'),
  ('JOSE EDUARDO VELOSO', 'SUM', 'Logística'),
  ('PABLO LOPES BRIAMONTE', 'SUM', 'Comercial Externo'),
  ('ROSANA VICENTIN DE OLIVEIRA', 'SUM', 'Comercial Externo'),
  ('VINICIUS MATHEUS DA COSTA AMADO', 'SUM', 'Logística'),
  ('CARLOS HENRIQUE GONCALVES', 'SUM', 'Logística'),
  ('NELSON DOS SANTOS ALVES', 'SUM', 'Logística'),
  ('WEDERSON NUNES DA ROCHA', 'SUM', 'Logística'),
  ('GABRIEL FELICIANO', 'SUM', 'Logística'),
  ('RODRIGO FONSECA DOS SANTOS', 'SUM', 'Logística'),
  ('ALINE ANDRESSA DA MOTA POPENDA', 'SJP', 'Gente & Gestão / Trade'),
  ('CARLOS SQUETINI', 'SP', 'Comercial Externo'),
  ('DANIEL MARCHIOTI DA SILVA', 'SJP', 'Comercial Interno'),
  ('GISELE GARCIA RIBEIRO', 'SJP', 'Controladoria'),
  ('JOSÉ LUIZ MENDES', 'RJ', 'Comercial Externo'),
  ('KATIANE ANDREATA', 'SJP', 'Financeiro'),
  ('KLEBER TERNEL DE SOUZA', 'MGÁ', 'Comercial Externo'),
  ('LUIZ CHICHINELLI', 'MGÁ', 'Comercial Externo'),
  ('PRISCILA AMORIM DUTRA', 'SP', 'Comercial Externo');

-- ─────────────────────────────────────────────────────────────────────
-- BLOCO 1 — conferência. Não altera nada.
-- ─────────────────────────────────────────────────────────────────────
SELECT 'colaborador não encontrado no portal' AS problema, l.colaborador AS nome, NULL AS detalhe
  FROM wg_lotacao l
 WHERE NOT EXISTS (SELECT 1 FROM public.employees e
                    WHERE pg_temp.wg_norm(e.name) = pg_temp.wg_norm(l.colaborador))
UNION ALL
SELECT 'no portal mas fora da planilha (fica como está)', e.name, e.department
  FROM public.employees e
 WHERE e.active
   AND NOT EXISTS (SELECT 1 FROM wg_lotacao l
                    WHERE pg_temp.wg_norm(e.name) = pg_temp.wg_norm(l.colaborador))
 ORDER BY 1, 2;

-- ─────────────────────────────────────────────────────────────────────
-- BLOCO 2 — preserva o que já existe.
-- Quem está no portal e não está na planilha mantém a filial que tem hoje:
-- o valor sai de `department` e vai para `unit`, que é o lugar certo dele.
-- ─────────────────────────────────────────────────────────────────────
UPDATE public.employees
   SET unit = department, updated_at = now()
 WHERE unit IS NULL AND department IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- BLOCO 3 — grava filial e setor da planilha.
-- ─────────────────────────────────────────────────────────────────────
UPDATE public.employees AS e
   SET unit       = l.filial,
       department = l.setor,
       updated_at = now()
  FROM wg_lotacao l
 WHERE pg_temp.wg_norm(e.name) = pg_temp.wg_norm(l.colaborador);

-- ─────────────────────────────────────────────────────────────────────
-- BLOCO 4 — resultado.
-- ─────────────────────────────────────────────────────────────────────
SELECT unit AS filial, count(*) AS colaboradores
  FROM public.employees WHERE active GROUP BY unit ORDER BY 2 DESC;

SELECT department AS setor, count(*) AS colaboradores
  FROM public.employees WHERE active GROUP BY department ORDER BY 2 DESC;
