import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { COOKIE_MAX_AGE, COOKIE_TOKEN, hashToken, normalizarNome, novoToken } from "@/lib/auth";
import { carregarConfig } from "@/lib/dados";
import { erro } from "@/lib/http";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Uma tela só: se o nome não existe, cria o usuário; se existe, confere a senha.
 */
export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => ({}))) as { nome?: string; senha?: string };
  const { nome, chave } = normalizarNome(corpo.nome ?? "");
  const senha = (corpo.senha ?? "").trim();

  if (nome.length < 3) return erro("Digite seu nome (com sobrenome, se tiver alguém com o mesmo nome).");
  if (senha.length < 4) return erro("A senha precisa ter pelo menos 4 caracteres.");

  const { data: existente } = await db()
    .from("usuarios")
    .select("id, senha_hash")
    .eq("nome_chave", chave)
    .maybeSingle();

  const token = novoToken();

  if (existente) {
    const confere = await bcrypt.compare(senha, existente.senha_hash);
    if (!confere) return erro("Esse nome já está cadastrado e a senha não confere.", 401);
    await db().from("usuarios").update({ token_hash: hashToken(token) }).eq("id", existente.id);
  } else {
    const config = await carregarConfig();
    if (!config.cadastro_aberto) {
      return erro("Os cadastros estão encerrados. Se você já se cadastrou, use o mesmo nome e senha.", 403);
    }
    const { error } = await db().from("usuarios").insert({
      nome,
      nome_chave: chave,
      senha_hash: await bcrypt.hash(senha, 10),
      token_hash: hashToken(token),
    });
    if (error?.code === "23505") return erro("Esse nome acabou de ser cadastrado. Tente entrar com a senha.", 409);
    if (error) return erro("Não foi possível criar seu cadastro. Tente de novo.", 500);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_TOKEN, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}
