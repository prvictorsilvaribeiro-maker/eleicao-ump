"use client";
import { useEffect, useMemo, useState } from "react";
import { Entrar } from "@/components/Entrar";
import { Resultado, Veredito } from "@/components/Resultado";
import { postJson, usePolling } from "@/components/usePolling";
import { tituloVotacao } from "@/lib/regras";
import type { CargoDiretoria, VotacaoDTO } from "@/lib/tipos";

type EstadoAdmin = {
  eu: { id: string; nome: string };
  config: { cadastroAberto: boolean; telaoModo: "auto" | "qr" | "diretoria" };
  usuarios: { id: string; nome: string; isAdmin: boolean; votou: boolean }[];
  candidatos: { id: string; nome: string; eleitoPara: string | null }[];
  diretoria: CargoDiretoria[];
  votacoes: VotacaoDTO[];
  pendentes: { votacaoId: string; sugestao: string[] }[];
};

export default function PainelMesa() {
  const { dados, erro, recarregar } = usePolling<EstadoAdmin>("/api/admin", 2000);
  const [msg, setMsg] = useState<string | null>(null);

  async function acao(corpo: Record<string, unknown>, confirmacao?: string) {
    if (confirmacao && !window.confirm(confirmacao)) return false;
    const falha = await postJson("/api/admin", corpo);
    setMsg(falha);
    await recarregar();
    return !falha;
  }

  if (!dados) {
    if (erro?.startsWith("Entre")) {
      return <main className="pagina"><Entrar cadastroAberto={false} aoEntrar={recarregar} /></main>;
    }
    return <main className="pagina"><p className="vazio">{erro ?? "Carregando…"}</p></main>;
  }

  const aberta = dados.votacoes.find((v) => v.status === "aberta") ?? null;
  const pendentes = dados.pendentes
    .map((p) => ({ ...p, v: dados.votacoes.find((v) => v.id === p.votacaoId)! }))
    .filter((p) => p.v);
  const encerradas = dados.votacoes.filter((v) => v.status === "encerrada");
  const diretoriaCompleta = dados.diretoria.every((c) => c.eleito);

  return (
    <main className="pagina pagina-larga">
      <header className="topo">
        <div>
          <h1>Painel da mesa</h1>
          <p>{dados.eu.nome}</p>
        </div>
        <div className="linha-botoes">
          <a className="botao botao-sec botao-mini" href="/telao" target="_blank" rel="noreferrer">Abrir telão</a>
          <a className="link" href="/">Votar</a>
        </div>
      </header>

      {(msg || erro) && <p className="erro-msg" role="alert" style={{ marginBottom: 14 }}>{msg ?? erro}</p>}

      <div className="grade-admin">
        <div className="pilha">
          {aberta && <VotacaoEmAndamento v={aberta} usuarios={dados.usuarios} acao={acao} />}

          {!aberta &&
            pendentes.map((p) => (
              <DecisaoPendente key={p.votacaoId} v={p.v} sugestao={p.sugestao} acao={acao} />
            ))}

          {!aberta && !diretoriaCompleta && (
            <NovaVotacao
              cargos={dados.diretoria.filter((c) => !c.eleito)}
              candidatos={dados.candidatos.filter((c) => !c.eleitoPara)}
              acao={acao}
            />
          )}

          {encerradas.length > 0 && (
            <section className="bloco">
              <h2>Votações encerradas</h2>
              {encerradas.map((v) => (
                <details key={v.id}>
                  <summary>{tituloVotacao(v.cargo, v.turno)}</summary>
                  <div className="pilha" style={{ paddingTop: 10 }}>
                    <Veredito v={v} />
                    <Resultado v={v} />
                  </div>
                </details>
              ))}
            </section>
          )}
        </div>

        <div className="pilha">
          <section className="bloco">
            <div className="bloco-titulo">
              <h2>Diretoria eleita</h2>
              {diretoriaCompleta && <span className="etiqueta etiqueta-ouro">Completa</span>}
            </div>
            <div className="diretoria-mini">
              {dados.diretoria.map((c) => (
                <div key={c.id}>
                  <span className="suave">{c.nome}</span>
                  <strong>{c.eleito ?? "—"}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="bloco">
            <h2>Telão</h2>
            <div className="linha-botoes">
              {(
                [
                  ["auto", "Acompanhar votação"],
                  ["qr", "QR code"],
                  ["diretoria", "Diretoria eleita"],
                ] as const
              ).map(([modo, rotulo]) => (
                <button
                  key={modo}
                  className={`botao botao-mini ${dados.config.telaoModo === modo ? "" : "botao-sec"}`}
                  onClick={() => acao({ acao: "telao", modo })}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </section>

          <Membros dados={dados} acao={acao} votacaoAberta={!!aberta} />
          <Candidatos candidatos={dados.candidatos} acao={acao} />
        </div>
      </div>
    </main>
  );
}

type FnAcao = (corpo: Record<string, unknown>, confirmacao?: string) => Promise<boolean>;

function VotacaoEmAndamento({ v, usuarios, acao }: { v: VotacaoDTO; usuarios: EstadoAdmin["usuarios"]; acao: FnAcao }) {
  const votaram = usuarios.filter((u) => u.votou);
  const faltam = usuarios.filter((u) => !u.votou);
  const pct = usuarios.length ? (votaram.length / usuarios.length) * 100 : 0;

  return (
    <section className="bloco bloco-ativo">
      <div className="bloco-titulo">
        <h2>{tituloVotacao(v.cargo, v.turno)}</h2>
        <span className="suave">Em votação</span>
      </div>
      <p className="suave">Candidatos: {v.opcoes.map((o) => o.nome).join(", ")}</p>

      <div className="progresso">
        <strong style={{ fontSize: "1.4rem" }}>
          {votaram.length} de {usuarios.length} votaram
        </strong>
        <div className="progresso-trilha"><div className="progresso-barra" style={{ width: `${pct}%` }} /></div>
        <span className="suave">{faltam.length === 0 ? "Todos votaram." : `Faltam ${faltam.length}.`}</span>
      </div>

      <div className="duas-colunas">
        <div>
          <h3>Faltam votar</h3>
          <ul className="lista">{faltam.map((u) => <li key={u.id}>{u.nome}</li>)}</ul>
        </div>
        <div>
          <h3>Já votaram</h3>
          <ul className="lista">{votaram.map((u) => <li key={u.id}>{u.nome}</li>)}</ul>
        </div>
      </div>

      <div className="linha-botoes">
        <button
          className="botao"
          onClick={() =>
            acao(
              { acao: "encerrar", votacaoId: v.id },
              faltam.length ? `Ainda faltam ${faltam.length} votos. Encerrar mesmo assim?` : undefined,
            )
          }
        >
          Encerrar votação
        </button>
        <button
          className="link"
          style={{ color: "#f3b4a8" }}
          onClick={() =>
            acao({ acao: "cancelar", votacaoId: v.id }, "Cancelar apaga esta votação e os votos já dados. Continuar?")
          }
        >
          Cancelar (aberta por engano)
        </button>
      </div>
    </section>
  );
}

function DecisaoPendente({ v, sugestao, acao }: { v: VotacaoDTO; sugestao: string[]; acao: FnAcao }) {
  const [selecionados, setSelecionados] = useState<string[]>(sugestao);
  const maisVotado = v.opcoes[0]?.candidatoId ?? "";
  const [eleito, setEleito] = useState(maisVotado);

  useEffect(() => setSelecionados(sugestao), [sugestao.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const alternar = (id: string) =>
    setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <section className="bloco" style={{ borderColor: "var(--ouro)", borderWidth: 2 }}>
      <h2>{tituloVotacao(v.cargo, v.turno)}: sem maioria</h2>
      <Resultado v={v} />

      <div className="pilha">
        <h3>Abrir {v.turno + 1}º turno</h3>
        <p className="suave">Já marquei os dois mais votados e os empatados. Ajuste se precisar.</p>
        <div className="checks">
          {v.opcoes.map((o) => (
            <label key={o.candidatoId} className="check">
              <input type="checkbox" checked={selecionados.includes(o.candidatoId)} onChange={() => alternar(o.candidatoId)} />
              <span>{o.nome}</span>
              <span className="suave" style={{ marginLeft: "auto" }}>{o.votos} votos</span>
            </label>
          ))}
        </div>
        <button
          className="botao"
          disabled={selecionados.length === 0}
          onClick={() => acao({ acao: "criarVotacao", cargoId: v.cargoId, candidatoIds: selecionados })}
        >
          Abrir {v.turno + 1}º turno com {selecionados.length} candidato{selecionados.length === 1 ? "" : "s"}
        </button>
      </div>

      <details>
        <summary>Encerrar com o resultado atual (decisão da mesa)</summary>
        <div className="pilha" style={{ paddingTop: 10 }}>
          <div className="campo">
            <label htmlFor={`eleito-${v.id}`}>Eleito</label>
            <select id={`eleito-${v.id}`} value={eleito} onChange={(e) => setEleito(e.target.value)}>
              {v.opcoes.map((o) => (
                <option key={o.candidatoId} value={o.candidatoId}>{o.nome} ({o.votos} votos)</option>
              ))}
            </select>
          </div>
          <button
            className="botao botao-sec"
            onClick={() =>
              acao(
                { acao: "definirEleito", votacaoId: v.id, candidatoId: eleito },
                `Definir ${v.opcoes.find((o) => o.candidatoId === eleito)?.nome} como eleito para ${v.cargo}?`,
              )
            }
          >
            Definir eleito
          </button>
        </div>
      </details>
    </section>
  );
}

function NovaVotacao({
  cargos,
  candidatos,
  acao,
}: {
  cargos: CargoDiretoria[];
  candidatos: EstadoAdmin["candidatos"];
  acao: FnAcao;
}) {
  const [cargoId, setCargoId] = useState<number>(cargos[0]?.id ?? 0);
  const [selecionados, setSelecionados] = useState<string[]>([]);

  useEffect(() => {
    if (!cargos.some((c) => c.id === cargoId)) setCargoId(cargos[0]?.id ?? 0);
  }, [cargos, cargoId]);

  const disponiveis = useMemo(() => new Set(candidatos.map((c) => c.id)), [candidatos]);
  const marcados = selecionados.filter((id) => disponiveis.has(id));

  const alternar = (id: string) =>
    setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function abrir() {
    const ok = await acao({ acao: "criarVotacao", cargoId, candidatoIds: marcados });
    if (ok) setSelecionados([]);
  }

  return (
    <section className="bloco">
      <h2>Nova votação</h2>
      <div className="campo">
        <label htmlFor="cargo">Cargo</label>
        <select id="cargo" value={cargoId} onChange={(e) => setCargoId(Number(e.target.value))}>
          {cargos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      <div className="campo">
        <label>Candidatos indicados</label>
        {candidatos.length === 0 ? (
          <p className="suave">Adicione candidatos na lista ao lado.</p>
        ) : (
          <div className="checks">
            {candidatos.map((c) => (
              <label key={c.id} className="check">
                <input type="checkbox" checked={marcados.includes(c.id)} onChange={() => alternar(c.id)} />
                <span>{c.nome}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <p className="suave">Ao abrir, os cadastros de novos membros são encerrados.</p>
      <button className="botao" disabled={marcados.length === 0 || !cargoId} onClick={abrir}>
        Abrir votação{marcados.length ? ` com ${marcados.length} candidato${marcados.length === 1 ? "" : "s"}` : ""}
      </button>
    </section>
  );
}

function Membros({ dados, acao, votacaoAberta }: { dados: EstadoAdmin; acao: FnAcao; votacaoAberta: boolean }) {
  return (
    <section className="bloco">
      <div className="bloco-titulo">
        <h2>Membros</h2>
        <small>{dados.usuarios.length} cadastrados</small>
      </div>
      <div className="linha-botoes" style={{ alignItems: "center" }}>
        <span className={`etiqueta ${dados.config.cadastroAberto ? "etiqueta-ouro" : ""}`}>
          Cadastro {dados.config.cadastroAberto ? "aberto" : "encerrado"}
        </span>
        {!votacaoAberta && (
          <button
            className="link"
            onClick={() => acao({ acao: "cadastro", aberto: !dados.config.cadastroAberto })}
          >
            {dados.config.cadastroAberto ? "Encerrar cadastros" : "Reabrir cadastros"}
          </button>
        )}
      </div>
      <ul className="lista">
        {dados.usuarios.map((u) => (
          <li key={u.id}>
            <span>
              {u.nome} {u.isAdmin && <span className="etiqueta">mesa</span>}
            </span>
            {u.id !== dados.eu.id && (
              <button
                className="link"
                style={{ color: "var(--perigo)" }}
                onClick={() => acao({ acao: "excluirUsuario", id: u.id }, `Excluir ${u.nome}?`)}
              >
                Excluir
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Candidatos({ candidatos, acao }: { candidatos: EstadoAdmin["candidatos"]; acao: FnAcao }) {
  const [nome, setNome] = useState("");

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (await acao({ acao: "adicionarCandidato", nome })) setNome("");
  }

  return (
    <section className="bloco">
      <div className="bloco-titulo">
        <h2>Candidatos</h2>
        <small>{candidatos.length} na lista</small>
      </div>
      <form className="linha-botoes" onSubmit={adicionar}>
        <div className="campo" style={{ flex: 1 }}>
          <input aria-label="Nome do candidato" placeholder="Nome do candidato" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <button className="botao">Adicionar</button>
      </form>
      <ul className="lista">
        {candidatos.map((c) => (
          <li key={c.id}>
            <span>
              {c.nome} {c.eleitoPara && <span className="etiqueta etiqueta-ouro">{c.eleitoPara}</span>}
            </span>
            {!c.eleitoPara && (
              <button
                className="link"
                style={{ color: "var(--perigo)" }}
                onClick={() => acao({ acao: "removerCandidato", id: c.id }, `Remover ${c.nome} da lista?`)}
              >
                Remover
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
