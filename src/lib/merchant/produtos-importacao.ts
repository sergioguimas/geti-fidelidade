import type { SupabaseClient } from "@supabase/supabase-js";

type ProdutoDb = {
  id: string;
  descricao: string;
  teto_percentual: number;
  ativo: boolean;
};

export type ProdutoImportRow = {
  linha: number;
  descricaoOriginal: string;
  descricao: string;
  descricaoNormalizada: string;
  tetoPercentual: number | null;
  ativo: boolean;
};

export type ProdutoImportInvalido = {
  linha: number;
  descricaoOriginal?: string;
  motivo: string;
};

export type ProdutoImportNovo = {
  linha: number;
  descricao: string;
  tetoPercentual: number;
  ativo: boolean;
};

export type ProdutoImportDuplicado = {
  linha: number;
  descricao: string;
  tetoPercentual: number;
  ativo: boolean;
  existente: {
    id: string;
    descricao: string;
    tetoPercentual: number;
    ativo: boolean;
  };
};

export type ProdutoImportPreviewResult = {
  novos: ProdutoImportNovo[];
  duplicados: ProdutoImportDuplicado[];
  invalidos: ProdutoImportInvalido[];
  resumo: {
    totalLinhas: number;
    novos: number;
    duplicados: number;
    invalidos: number;
  };
};

export type ProdutoImportConfirmItem = {
  linha: number;
  id?: string;
  descricao: string;
  tetoPercentual: number;
  ativo: boolean;
  acao: "criar" | "atualizar";
};

function normalizarDescricao(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseBoolean(value: string | undefined) {
  const normalizado = (value ?? "").trim().toLowerCase();

  if (!normalizado) return true;

  if (["sim", "s", "true", "1", "ativo"].includes(normalizado)) return true;
  if (["nao", "não", "n", "false", "0", "inativo"].includes(normalizado)) return false;

  return true;
}

function parseNumero(value: string | undefined) {
  if (!value?.trim()) return null;

  const normalizado = value.trim().replace("%", "").replace(",", ".");
  const numero = Number(normalizado);

  if (Number.isNaN(numero)) return null;
  return numero;
}

export function parseCsvProdutos(csv: string) {
  const linhas = csv
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((linha) => linha.trim().length > 0);

  if (!linhas.length) {
    throw new Error("CSV vazio.");
  }

  const separador = linhas[0].includes(";") ? ";" : ",";
  const header = linhas[0].split(separador).map((col) => col.trim());

  const idxDescricao = header.findIndex((h) => h === "descricao");
  const idxTeto = header.findIndex((h) => h === "tetoPercentual");
  const idxAtivo = header.findIndex((h) => h === "ativo");

  if (idxDescricao === -1 || idxTeto === -1) {
    throw new Error("O CSV deve conter as colunas obrigatórias: descricao, tetoPercentual e opcionalmente ativo.");
  }

  const rows: ProdutoImportRow[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i].split(separador).map((col) => col.trim());

    const descricaoOriginal = colunas[idxDescricao] ?? "";
    const descricao = descricaoOriginal.trim();
    const tetoPercentual = parseNumero(colunas[idxTeto]);
    const ativo = parseBoolean(idxAtivo >= 0 ? colunas[idxAtivo] : undefined);

    rows.push({
      linha: i + 1,
      descricaoOriginal,
      descricao,
      descricaoNormalizada: normalizarDescricao(descricao),
      tetoPercentual,
      ativo,
    });
  }

  return rows;
}

export async function listarProdutosMapa(
  supabase: SupabaseClient,
  lojistaId: string
) {
  const { data, error } = await supabase
    .from("produtos")
    .select("id, descricao, teto_percentual, ativo")
    .eq("lojista_id", lojistaId);

  if (error) {
    throw new Error("Erro ao carregar produtos existentes para importação.");
  }

  const mapa = new Map<string, ProdutoDb>();

  for (const item of (data ?? []) as ProdutoDb[]) {
    mapa.set(normalizarDescricao(item.descricao), item);
  }

  return mapa;
}

export async function gerarPreviewImportacaoProdutos(
  supabase: SupabaseClient,
  lojistaId: string,
  csv: string
): Promise<ProdutoImportPreviewResult> {
  const rows = parseCsvProdutos(csv);
  const mapaExistentes = await listarProdutosMapa(supabase, lojistaId);

  const novos: ProdutoImportNovo[] = [];
  const duplicados: ProdutoImportDuplicado[] = [];
  const invalidos: ProdutoImportInvalido[] = [];

  const descricoesNoArquivo = new Map<string, number>();

  for (const row of rows) {
    if (!row.descricao) {
      invalidos.push({
        linha: row.linha,
        descricaoOriginal: row.descricaoOriginal,
        motivo: "Descrição obrigatória.",
      });
      continue;
    }

    if (row.descricao.length > 200) {
      invalidos.push({
        linha: row.linha,
        descricaoOriginal: row.descricaoOriginal,
        motivo: "Descrição ultrapassa 200 caracteres.",
      });
      continue;
    }

    if (row.tetoPercentual == null) {
      invalidos.push({
        linha: row.linha,
        descricaoOriginal: row.descricaoOriginal,
        motivo: "tetoPercentual inválido ou vazio.",
      });
      continue;
    }

    if (row.tetoPercentual < 0 || row.tetoPercentual > 100) {
      invalidos.push({
        linha: row.linha,
        descricaoOriginal: row.descricaoOriginal,
        motivo: "tetoPercentual deve estar entre 0 e 100.",
      });
      continue;
    }

    const primeiraLinha = descricoesNoArquivo.get(row.descricaoNormalizada);
    if (primeiraLinha) {
      invalidos.push({
        linha: row.linha,
        descricaoOriginal: row.descricaoOriginal,
        motivo: `Descrição duplicada no próprio CSV. Já informada na linha ${primeiraLinha}.`,
      });
      continue;
    }

    descricoesNoArquivo.set(row.descricaoNormalizada, row.linha);

    const existente = mapaExistentes.get(row.descricaoNormalizada);

    if (existente) {
      duplicados.push({
        linha: row.linha,
        descricao: row.descricao,
        tetoPercentual: row.tetoPercentual,
        ativo: row.ativo,
        existente: {
          id: existente.id,
          descricao: existente.descricao,
          tetoPercentual: Number(existente.teto_percentual),
          ativo: existente.ativo,
        },
      });
      continue;
    }

    novos.push({
      linha: row.linha,
      descricao: row.descricao,
      tetoPercentual: row.tetoPercentual,
      ativo: row.ativo,
    });
  }

  return {
    novos,
    duplicados,
    invalidos,
    resumo: {
      totalLinhas: rows.length,
      novos: novos.length,
      duplicados: duplicados.length,
      invalidos: invalidos.length,
    },
  };
}