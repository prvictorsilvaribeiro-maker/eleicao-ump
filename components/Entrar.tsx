"use client";
import { useState } from "react";
import { postJson } from "./usePolling";

export function Entrar({ cadastroAberto, aoEntrar }: { cadastroAberto: boolean; aoEntrar: () => void }) {
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(await postJson("/api/entrar", { nome, senha }));
    setEnviando(false);
    aoEntrar();
  }

  return (
    <form className="bloco" onSubmit={enviar}>
      <div className="pilha">
        <h1>Eleição da diretoria</h1>
        <p className="suave">
          {cadastroAberto
            ? "Digite seu nome e escolha uma senha. Se você já se cadastrou, use o mesmo nome e senha."
            : "Os cadastros estão encerrados. Entre com o nome e a senha que você cadastrou."}
        </p>
      </div>
      <div className="campo">
        <label htmlFor="nome">Seu nome</label>
        <input id="nome" autoComplete="name" autoCapitalize="words" value={nome} onChange={(e) => setNome(e.target.value)} required />
      </div>
      <div className="campo">
        <label htmlFor="senha">Senha</label>
        <input
          id="senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          minLength={4}
          required
        />
        <small className="suave">Pelo menos 4 caracteres. Serve para entrar de novo se você trocar de celular.</small>
      </div>
      {erro && <p className="erro-msg" role="alert">{erro}</p>}
      <button className="botao botao-largo" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
