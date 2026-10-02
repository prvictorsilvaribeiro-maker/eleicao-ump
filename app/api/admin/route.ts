import { usuarioAtual } from "@/lib/auth";
import { carregarConfig, carregarDiretoria, carregarVotacoes } from "@/lib/dados";
import { erro, erroSql, ok } from "@/lib/http";
import { sugerirProximoTurno } from "@/lib/regras";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function exigirAdmin() {
  const u = await usuarioAtual();
  if (!u) return { resposta: erro("Entre com seu nome e senha.", 401) };
  if (!u.is_admin) return { resposta: erro("Acesso restrito à mesa.", 403) };
  return { admin: u };
}

export async function GET() {
  const { admin, resposta } = await exigirAdmin();
  if (!admin) return resposta;

  try {
    const [config, votacoes, us, cs] = await Promise.all([
      carregarConfig(),
      carregarVotacoes(),
      db().from("usuarios").select("id, nome, is_admin").order("nome"),
      db().from("candidatos").select("id, nome").eq("ativo", true).order("nome"),
    ]);
    const diretoria = await carregarDiretoria(votacoes);
    const aberta = votacoes.find((v) => v.status === "aberta") ?? null;

    // Quem já votou na votação aberta (só presença, nunca o voto)
    let votaram = new Set<string>();
    if (aberta) {
      const { data } = await db().from("participacoes").select("usuario_id").eq("votacao_id", aberta.id);
      votaram = new Set((data ?? []).map((p: { usuario_id: string }) => p.usuario_id));
    }

    const eleitos = new Map(
      votacoes.filter((v) => v.eleitoId).map((v) => [v.eleitoId as string, v.cargo]),
    );

    return ok({
      eu: { id: admin.id, nome: admin.nome },
      config: { cadastroAberto: config.cadastro_aberto, telaoModo: config.telao_modo },
      usuarios: (us.data ?? []).map((u: { id: string; nome: string; is_admin: boolean }) => ({
        id: u.id,
        nome: u.nome,
        isAdmin: u.is_admin,
        votou: votaram.has(u.id),
      })),
      candidatos: (cs.data ?? []).map((c: { id: string; nome: string }) => ({
        id: c.id,
        nome: c.nome,
        eleitoPara: eleitos.get(c.id) ?? null,
      })),
      diretoria,
      votacoes,
      pendentes: votacoes
        .filter((v) => v.resultado === "pendente")
        .map((v) => ({ votacaoId: v.id, sugestao: sugerirProximoTurno(v.opcoes) })),
    });
  } catch {
    return erro("Falha ao carregar o painel.", 500);
  }
}

type Acao =
  | { acao: "cadastro"; aberto: boolean }
  | { acao: "telao"; modo: "auto" | "qr" | "diretoria" }
  | { acao: "excluirUsuario"; id: string }
  | { acao: "adicionarCandidato"; nome: string }
  | { acao: "removerCandidato"; id: string }
  | { acao: "criarVotacao"; cargoId: number; candidatoIds: string[] }
  | { acao: "encerrar"; votacaoId: string }
  | { acao: "cancelar"; votacaoId: string }
  | { acao: "definirEleito"; votacaoId: string; candidatoId: string };

export async function POST(req: Request) {
  const { admin, resposta } = await exigirAdmin();
  if (!admin) return resposta;

  const a = (await req.json().catch(() => null)) as Acao | null;
  if (!a) return erro("Requisição inválida.");

  switch (a.acao) {
    case "cadastro": {
      const { error } = await db().from("configuracao").update({ cadastro_aberto: !!a.aberto }).eq("id", 1);
      return error ? erroSql(error, "Falha ao alterar cadastros.") : ok({ ok: true });
    }

    case "telao": {
      if (!["auto", "qr", "diretoria"].includes(a.modo)) return erro("Modo inválido.");
      const { error } = await db().from("configuracao").update({ telao_modo: a.modo }).eq("id", 1);
      return error ? erroSql(error, "Falha ao alterar o telão.") : ok({ ok: true });
    }

    case "excluirUsuario": {
      if (a.id === admin.id) return erro("Você não pode excluir a si mesmo.");
      const { count } = await db()
        .from("participacoes")
        .select("usuario_id", { count: "exact", head: true })
        .eq("usuario_id", a.id);
      if ((count ?? 0) > 0) return erro("Este usuário já votou e não pode mais ser excluído.");
      const { error } = await db().from("usuarios").delete().eq("id", a.id);
      return error ? erroSql(error, "Falha ao excluir.") : ok({ ok: true });
    }

    case "adicionarCandidato": {
      const nome = (a.nome ?? "").trim().replace(/\s+/g, " ");
      if (nome.length < 2) return erro("Digite o nome do candidato.");
      const { error } = await db().from("candidatos").insert({ nome });
      if (error?.code === "23505") return erro("Esse nome já está na lista.", 409);
      return error ? erroSql(error, "Falha ao adicionar.") : ok({ ok: true });
    }

    case "removerCandidato": {
      // Se já participou de alguma votação, só desativa (mantém o histórico)
      const { count } = await db()
        .from("votacao_opcoes")
        .select("candidato_id", { count: "exact", head: true })
        .eq("candidato_id", a.id);
      const { error } =
        (count ?? 0) > 0
          ? await db().from("candidatos").update({ ativo: false }).eq("id", a.id)
          : await db().from("candidatos").delete().eq("id", a.id);
      return error ? erroSql(error, "Falha ao remover.") : ok({ ok: true });
    }

    case "criarVotacao": {
      const { error } = await db().rpc("criar_votacao", {
        p_cargo: a.cargoId,
        p_candidatos: a.candidatoIds ?? [],
      });
      return error ? erroSql(error, "Falha ao abrir a votação.") : ok({ ok: true });
    }

    case "encerrar": {
      const { error } = await db().rpc("encerrar_votacao", { p_votacao: a.votacaoId });
      return error ? erroSql(error, "Falha ao encerrar.") : ok({ ok: true });
    }

    case "cancelar": {
      // Para quando a votação foi aberta por engano. Apaga votos e participações dela.
      const { error } = await db().from("votacoes").delete().eq("id", a.votacaoId).eq("status", "aberta");
      return error ? erroSql(error, "Falha ao cancelar.") : ok({ ok: true });
    }

    case "definirEleito": {
      const { data: opcao } = await db()
        .from("votacao_opcoes")
        .select("candidato_id")
        .eq("votacao_id", a.votacaoId)
        .eq("candidato_id", a.candidatoId)
        .maybeSingle();
      if (!opcao) return erro("Esse candidato não participou desta votação.");
      const { data, error } = await db()
        .from("votacoes")
        .update({ eleito_id: a.candidatoId, resultado: "decisao_manual" })
        .eq("id", a.votacaoId)
        .eq("status", "encerrada")
        .eq("resultado", "pendente")
        .select("id");
      if (error) return erroSql(error, "Falha ao definir o eleito.");
      if (!data?.length) return erro("Esta votação não está aguardando decisão.");
      return ok({ ok: true });
    }

    default:
      return erro("Ação desconhecida.");
  }
}
