import type { OpcaoDTO } from "./tipos";

/** Mais de 50% de TODOS os votos (abstenções entram no total). */
export function temMaioria(votos: number, total: number) {
  return total > 0 && votos * 2 > total;
}

/**
 * Próximo turno: os dois mais votados + todos empatados com o segundo.
 * Ex.: 5, 3, 3, 3, 1  ->  5, 3, 3, 3
 *      5, 5, 5, 2     ->  5, 5, 5
 */
export function sugerirProximoTurno(opcoes: OpcaoDTO[]): string[] {
  const ordenadas = [...opcoes].sort((a, b) => (b.votos ?? 0) - (a.votos ?? 0));
  if (ordenadas.length <= 2) return ordenadas.map((o) => o.candidatoId);
  const corte = ordenadas[1].votos ?? 0;
  return ordenadas.filter((o) => (o.votos ?? 0) >= corte).map((o) => o.candidatoId);
}

export function tituloVotacao(cargo: string, turno: number) {
  return turno > 1 ? `${cargo}, ${turno}º turno` : cargo;
}
