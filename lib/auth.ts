import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { db } from "./supabase";

export const COOKIE_TOKEN = "eleicao_token";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

export type UsuarioSessao = { id: string; nome: string; is_admin: boolean };

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function novoToken() {
  return randomBytes(32).toString("hex");
}

/** "  joão   da Silva " -> { nome: "joão da Silva", chave: "joão da silva" } */
export function normalizarNome(bruto: string) {
  const nome = bruto.trim().replace(/\s+/g, " ");
  return { nome, chave: nome.toLocaleLowerCase("pt-BR") };
}

export async function usuarioAtual(): Promise<UsuarioSessao | null> {
  const token = (await cookies()).get(COOKIE_TOKEN)?.value;
  if (!token) return null;
  const { data } = await db()
    .from("usuarios")
    .select("id, nome, is_admin")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  return (data as UsuarioSessao | null) ?? null;
}
