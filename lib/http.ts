import { NextResponse } from "next/server";

export function ok<T>(dados: T) {
  return NextResponse.json(dados, { headers: { "Cache-Control": "no-store" } });
}

export function erro(mensagem: string, status = 400) {
  return NextResponse.json({ erro: mensagem }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Traduz erros levantados pelas funções SQL em mensagens para a tela. */
const MENSAGENS: Record<string, string> = {
  VOTACAO_FECHADA: "Esta votação já foi encerrada.",
  CANDIDATO_INVALIDO: "Candidato inválido para esta votação.",
  JA_EXISTE_ABERTA: "Já existe uma votação aberta. Encerre-a antes de abrir outra.",
  CARGO_CONCLUIDO: "Este cargo já tem um eleito.",
  SEM_CANDIDATOS: "Selecione pelo menos um candidato.",
  CANDIDATO_JA_ELEITO: "Um dos candidatos selecionados já foi eleito para outro cargo.",
  VOTACAO_NAO_ABERTA: "Esta votação não está aberta.",
};

export function erroSql(e: { code?: string; message?: string } | null, padrao: string) {
  if (!e) return erro(padrao);
  if (e.code === "23505") return erro("Registro duplicado.", 409);
  const chave = Object.keys(MENSAGENS).find((k) => e.message?.includes(k));
  return erro(chave ? MENSAGENS[chave] : padrao, chave ? 400 : 500);
}
