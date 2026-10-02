import { usuarioAtual } from "@/lib/auth";
import { carregarConfig, carregarVotacoes } from "@/lib/dados";
import { erro, ok } from "@/lib/http";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Estado da tela do membro (polling). */
export async function GET() {
  try {
    const [usuario, config] = await Promise.all([usuarioAtual(), carregarConfig()]);
    if (!usuario) return ok({ usuario: null, cadastroAberto: config.cadastro_aberto, votacoes: [] });

    const [votacoes, part] = await Promise.all([
      carregarVotacoes(),
      db().from("participacoes").select("votacao_id").eq("usuario_id", usuario.id),
    ]);
    const votei = new Set((part.data ?? []).map((p: { votacao_id: string }) => p.votacao_id));

    return ok({
      usuario: { nome: usuario.nome, isAdmin: usuario.is_admin },
      cadastroAberto: config.cadastro_aberto,
      votacoes: votacoes.map((v) => ({ ...v, votou: votei.has(v.id) })),
    });
  } catch {
    return erro("Falha ao carregar. Verifique a conexão.", 500);
  }
}
