import { usuarioAtual } from "@/lib/auth";
import { erro, erroSql, ok } from "@/lib/http";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const usuario = await usuarioAtual();
  if (!usuario) return erro("Entre com seu nome e senha para votar.", 401);

  const corpo = (await req.json().catch(() => ({}))) as { votacaoId?: string; candidatoId?: string | null };
  if (!corpo.votacaoId) return erro("Votação não informada.");

  const { error } = await db().rpc("registrar_voto", {
    p_usuario: usuario.id,
    p_votacao: corpo.votacaoId,
    p_candidato: corpo.candidatoId ?? null, // null = abstenção
  });

  if (error?.code === "23505") return erro("Você já votou nesta votação.", 409);
  if (error) return erroSql(error, "Não foi possível registrar o voto. Tente de novo.");
  return ok({ ok: true });
}
