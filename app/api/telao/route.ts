import { carregarConfig, carregarDiretoria, carregarVotacoes, contarMembros } from "@/lib/dados";
import { erro, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Público: só dados agregados (nunca quem votou em quem). */
export async function GET() {
  try {
    const [config, votacoes, totalMembros] = await Promise.all([carregarConfig(), carregarVotacoes(), contarMembros()]);
    const diretoria = await carregarDiretoria(votacoes);
    return ok({
      modo: config.telao_modo,
      cadastroAberto: config.cadastro_aberto,
      totalMembros,
      aberta: votacoes.find((v) => v.status === "aberta") ?? null,
      ultimaEncerrada: votacoes.find((v) => v.status === "encerrada") ?? null,
      diretoria,
    });
  } catch {
    return erro("Falha ao carregar.", 500);
  }
}
