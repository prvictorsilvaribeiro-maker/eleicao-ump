"use client";
import { useState } from "react";
import { Entrar } from "@/components/Entrar";
import { Resultado, Veredito } from "@/components/Resultado";
import { postJson, usePolling } from "@/components/usePolling";
import { tituloVotacao } from "@/lib/regras";
import type { VotacaoDTO } from "@/lib/tipos";

type VotacaoMembro = VotacaoDTO & { votou: boolean };
type Estado = {
  usuario: { nome: string; isAdmin: boolean } | null;
  cadastroAberto: boolean;
  votacoes: VotacaoMembro[];
};

export default function PaginaMembro() {
  const { dados, erro, recarregar } = usePolling<Estado>("/api/estado", 3000);

  if (!dados) {
    return <main className="pagina"><p className="vazio">{erro ?? "Carregando…"}</p></main>;
  }

  if (!dados.usuario) {
    return (
      <main className="pagina">
        <Entrar cadastroAberto={dados.cadastroAberto} aoEntrar={recarregar} />
      </main>
    );
  }

  async function sair() {
    await postJson("/api/sair", {});
    recarregar();
  }

  return (
    <main className="pagina">
      <header className="topo">
        <div>
          <h1>Olá, {dados.usuario.nome.split(" ")[0]}</h1>
          <p>Eleição da diretoria</p>
        </div>
        <div className="linha-botoes">
          {dados.usuario.isAdmin && <a className="link" href="/admin">Painel da mesa</a>}
          <button className="link" onClick={sair}>Sair</button>
        </div>
      </header>

      {erro && <p className="erro-msg" role="status">{erro}</p>}

      {dados.votacoes.length === 0 ? (
        <p className="vazio">Nenhuma votação aberta ainda. Esta tela atualiza sozinha quando a mesa abrir a próxima.</p>
      ) : (
        <div className="pilha">
          {dados.votacoes.map((v) => (
            <CartaoVotacao key={v.id} v={v} aoVotar={recarregar} isAdmin={dados.usuario!.isAdmin} />
          ))}
        </div>
      )}
    </main>
  );
}

function CartaoVotacao({ v, aoVotar, isAdmin }: { v: VotacaoMembro; aoVotar: () => void; isAdmin: boolean }) {
  const titulo = tituloVotacao(v.cargo, v.turno);

  if (v.status === "encerrada") {
    return (
      <section className="bloco">
        <h2>{titulo}</h2>
        <Veredito v={v} />
        <Resultado v={v} />
      </section>
    );
  }

  return (
    <section className="bloco bloco-ativo" aria-live="polite">
      <h2>{titulo}</h2>
      {isAdmin ? (
        <p className="suave">A mesa acompanha pelo painel e não vota.</p>
      ) : v.votou ? (
        <div className="aguardando">
          <span className="pulso" aria-hidden />
          <span>Voto registrado. Aguardando a mesa encerrar a votação.</span>
        </div>
      ) : (
        <Cedula v={v} aoVotar={aoVotar} />
      )}
    </section>
  );
}

const ABSTER = "__abster__";

function Cedula({ v, aoVotar }: { v: VotacaoMembro; aoVotar: () => void }) {
  const [escolha, setEscolha] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const nomeEscolhido =
    escolha === ABSTER ? null : v.opcoes.find((o) => o.candidatoId === escolha)?.nome;

  async function confirmar() {
    if (!escolha) return;
    setEnviando(true);
    const falha = await postJson("/api/votar", {
      votacaoId: v.id,
      candidatoId: escolha === ABSTER ? null : escolha,
    });
    setEnviando(false);
    setErro(falha);
    aoVotar();
  }

  return (
    <div className="cedula">
      <p className="suave">Toque em um nome e confirme. Você só pode votar uma vez.</p>
      {v.opcoes.map((o) => (
        <button
          key={o.candidatoId}
          className="opcao"
          aria-pressed={escolha === o.candidatoId}
          onClick={() => setEscolha(o.candidatoId)}
        >
          {o.nome}
        </button>
      ))}
      <button className="opcao opcao-abster" aria-pressed={escolha === ABSTER} onClick={() => setEscolha(ABSTER)}>
        Abster-me
      </button>
      {erro && <p className="erro-msg" role="alert">{erro}</p>}
      <button className="botao botao-largo" disabled={!escolha || enviando} onClick={confirmar}>
        {enviando
          ? "Registrando…"
          : !escolha
            ? "Escolha uma opção"
            : nomeEscolhido
              ? `Confirmar voto em ${nomeEscolhido}`
              : "Confirmar abstenção"}
      </button>
    </div>
  );
}
