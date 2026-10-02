import "server-only";
import { db } from "./supabase";
import type { CargoDiretoria, OpcaoDTO, VotacaoDTO } from "./tipos";

type LinhaVotacao = {
  id: string;
  cargo_id: number;
  turno: number;
  status: "aberta" | "encerrada";
  total_votos: number;
  abstencoes: number;
  resultado: VotacaoDTO["resultado"];
  eleito_id: string | null;
  cargos: { nome: string } | { nome: string }[] | null;
};

type LinhaOpcao = {
  votacao_id: string;
  candidato_id: string;
  votos: number;
  candidatos: { nome: string } | { nome: string }[] | null;
};

const nomeDe = (r: { nome: string } | { nome: string }[] | null) =>
  (Array.isArray(r) ? r[0]?.nome : r?.nome) ?? "";

/** Todas as votações, mais recente primeiro. Votos só aparecem nas encerradas. */
export async function carregarVotacoes(): Promise<VotacaoDTO[]> {
  const { data: vs, error } = await db()
    .from("votacoes")
    .select("id, cargo_id, turno, status, total_votos, abstencoes, resultado, eleito_id, cargos(nome)")
    .order("criada_em", { ascending: false });
  if (error) throw error;
  const votacoes = (vs ?? []) as unknown as LinhaVotacao[];
  if (votacoes.length === 0) return [];

  const { data: ops, error: e2 } = await db()
    .from("votacao_opcoes")
    .select("votacao_id, candidato_id, votos, candidatos(nome)")
    .in("votacao_id", votacoes.map((v) => v.id));
  if (e2) throw e2;
  const opcoes = (ops ?? []) as unknown as LinhaOpcao[];

  return votacoes.map((v) => {
    const encerrada = v.status === "encerrada";
    const minhas: OpcaoDTO[] = opcoes
      .filter((o) => o.votacao_id === v.id)
      .map((o) => ({ candidatoId: o.candidato_id, nome: nomeDe(o.candidatos), votos: encerrada ? o.votos : null }))
      .sort((a, b) => (encerrada ? (b.votos ?? 0) - (a.votos ?? 0) : 0) || a.nome.localeCompare(b.nome, "pt-BR"));

    return {
      id: v.id,
      cargoId: v.cargo_id,
      cargo: nomeDe(v.cargos),
      turno: v.turno,
      status: v.status,
      totalVotos: v.total_votos,
      abstencoes: encerrada ? v.abstencoes : null,
      resultado: encerrada ? v.resultado : null,
      eleitoId: v.eleito_id,
      eleitoNome: minhas.find((o) => o.candidatoId === v.eleito_id)?.nome ?? null,
      opcoes: minhas,
    };
  });
}

export async function carregarDiretoria(votacoes: VotacaoDTO[]): Promise<CargoDiretoria[]> {
  const { data, error } = await db().from("cargos").select("id, nome").order("ordem");
  if (error) throw error;
  return (data ?? []).map((c: { id: number; nome: string }) => ({
    id: c.id,
    nome: c.nome,
    eleito: votacoes.find((v) => v.cargoId === c.id && v.eleitoNome)?.eleitoNome ?? null,
  }));
}

export async function carregarConfig() {
  const { data, error } = await db().from("configuracao").select("cadastro_aberto, telao_modo").eq("id", 1).single();
  if (error) throw error;
  return data as { cadastro_aberto: boolean; telao_modo: "auto" | "qr" | "diretoria" };
}

export async function contarMembros() {
  const { count, error } = await db().from("usuarios").select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
