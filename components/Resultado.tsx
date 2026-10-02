import type { VotacaoDTO } from "@/lib/tipos";

/** Barras com a linha dos 50%: quem passa dela é eleito. */
export function Resultado({ v }: { v: VotacaoDTO }) {
  const total = v.totalVotos;
  const linhas = [
    ...v.opcoes.map((o) => ({
      id: o.candidatoId,
      nome: o.nome,
      votos: o.votos ?? 0,
      eleita: o.candidatoId === v.eleitoId,
      abst: false,
    })),
    { id: "abst", nome: "Abstenções", votos: v.abstencoes ?? 0, eleita: false, abst: true },
  ];

  return (
    <div className="resultado">
      {linhas.map((l) => {
        const pct = total ? (l.votos / total) * 100 : 0;
        return (
          <div key={l.id} className={`linha-res${l.eleita ? " eleita" : ""}${l.abst ? " abst" : ""}`}>
            <div className="linha-res-topo">
              <span className="linha-res-nome">{l.nome}</span>
              <span className="linha-res-num">
                {l.votos} <small>({Math.round(pct)}%)</small>
              </span>
            </div>
            <div className="trilha" role="img" aria-label={`${l.nome}: ${l.votos} de ${total} votos`}>
              <div className="barra" style={{ width: `${pct}%` }} />
              <div className="marca-maioria" aria-hidden />
            </div>
          </div>
        );
      })}
      <p className="legenda-maioria">
        A linha tracejada marca 50% dos {total} votos (abstenções contam). É eleito quem passar dela.
      </p>
    </div>
  );
}

export function Veredito({ v }: { v: VotacaoDTO }) {
  switch (v.resultado) {
    case "maioria":
      return <p className="veredito">{v.eleitoNome} eleito com maioria dos votos</p>;
    case "decisao_manual":
      return <p className="veredito">{v.eleitoNome} definido pela mesa</p>;
    case "novo_turno":
      return <p className="veredito veredito-sem">Ninguém passou de 50%. Houve novo turno.</p>;
    case "pendente":
      return <p className="veredito veredito-sem">Ninguém passou de 50%. Aguardando a mesa.</p>;
    default:
      return null;
  }
}
