export type Resultado = "maioria" | "pendente" | "novo_turno" | "decisao_manual" | null;

export type OpcaoDTO = {
  candidatoId: string;
  nome: string;
  /** null enquanto a votação está aberta: ninguém vê parcial */
  votos: number | null;
};

export type VotacaoDTO = {
  id: string;
  cargoId: number;
  cargo: string;
  turno: number;
  status: "aberta" | "encerrada";
  totalVotos: number;
  abstencoes: number | null;
  resultado: Resultado;
  eleitoId: string | null;
  eleitoNome: string | null;
  opcoes: OpcaoDTO[];
};

export type CargoDiretoria = { id: number; nome: string; eleito: string | null };
