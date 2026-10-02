"use client";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Resultado, Veredito } from "@/components/Resultado";
import { usePolling } from "@/components/usePolling";
import { tituloVotacao } from "@/lib/regras";
import type { CargoDiretoria, VotacaoDTO } from "@/lib/tipos";

type EstadoTelao = {
  modo: "auto" | "qr" | "diretoria";
  cadastroAberto: boolean;
  totalMembros: number;
  aberta: VotacaoDTO | null;
  ultimaEncerrada: VotacaoDTO | null;
  diretoria: CargoDiretoria[];
};

export default function Telao() {
  const { dados, erro } = usePolling<EstadoTelao>("/api/telao", 2000);
  const [link, setLink] = useState("");
  useEffect(() => setLink(window.location.origin), []);

  if (!dados) return <main className="telao"><p className="vazio">{erro ?? "Carregando…"}</p></main>;

  const linkCurto = link.replace(/^https?:\/\//, "");
  let tela: React.ReactNode;

  if (dados.modo === "diretoria") {
    tela = <TelaDiretoria diretoria={dados.diretoria} />;
  } else if (dados.modo === "qr" || (!dados.aberta && !dados.ultimaEncerrada)) {
    tela = <TelaQr link={link} linkCurto={linkCurto} total={dados.totalMembros} cadastroAberto={dados.cadastroAberto} />;
  } else if (dados.aberta) {
    tela = <TelaVotando v={dados.aberta} total={dados.totalMembros} />;
  } else {
    tela = <TelaResultado v={dados.ultimaEncerrada!} />;
  }

  return (
    <main className="telao">
      {tela}
      <footer className="telao-rodape">
        <span>UMP da Igreja Presbiteriana de Brasília</span>
        {dados.cadastroAberto && dados.modo !== "qr" && link && (
          <span className="telao-qr-mini">
            <QRCodeSVG value={link} />
            <span>Ainda não se cadastrou?<br />{linkCurto}</span>
          </span>
        )}
      </footer>
    </main>
  );
}

function TelaQr({ link, linkCurto, total, cadastroAberto }: { link: string; linkCurto: string; total: number; cadastroAberto: boolean }) {
  return (
    <>
      <header>
        <h1 className="telao-cargo">Eleição da diretoria</h1>
        <p className="telao-sub">{cadastroAberto ? "Aponte a câmera do celular para o código e faça seu cadastro." : "Aponte a câmera do celular para o código para entrar."}</p>
      </header>
      <div className="telao-corpo telao-qr">
        {link && <QRCodeSVG value={link} marginSize={1} />}
        <div className="pilha">
          <p className="telao-contagem">{total}</p>
          <p className="telao-sub">membros cadastrados</p>
          <p className="telao-sub">{linkCurto}</p>
        </div>
      </div>
    </>
  );
}

function TelaVotando({ v, total }: { v: VotacaoDTO; total: number }) {
  const pct = total ? (v.totalVotos / total) * 100 : 0;
  return (
    <>
      <header>
        <h1 className="telao-cargo">{tituloVotacao(v.cargo, v.turno)}</h1>
        <p className="telao-sub">Votação aberta</p>
      </header>
      <div className="telao-corpo">
        <div className="telao-nomes">
          {v.opcoes.map((o) => <span key={o.candidatoId}>{o.nome}</span>)}
        </div>
        <div className="progresso">
          <p className="telao-contagem">
            {v.totalVotos} <span>de {total} já votaram</span>
          </p>
          <div className="progresso-trilha"><div className="progresso-barra" style={{ width: `${pct}%` }} /></div>
        </div>
      </div>
    </>
  );
}

function TelaResultado({ v }: { v: VotacaoDTO }) {
  return (
    <>
      <header>
        <h1 className="telao-cargo">{tituloVotacao(v.cargo, v.turno)}</h1>
        <p className="telao-sub">Resultado: {v.totalVotos} votos</p>
      </header>
      <div className="telao-corpo">
        <Veredito v={v} />
        <Resultado v={v} />
      </div>
    </>
  );
}

function TelaDiretoria({ diretoria }: { diretoria: CargoDiretoria[] }) {
  return (
    <>
      <header>
        <h1 className="telao-cargo">Diretoria eleita</h1>
        <p className="telao-sub">Eleita hoje pela UMP</p>
      </header>
      <dl className="telao-corpo telao-diretoria">
        {diretoria.map((c) => (
          <div key={c.id}>
            <dt>{c.nome}</dt>
            <dd className={c.eleito ? "" : "vaga"}>{c.eleito ?? "a definir"}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
