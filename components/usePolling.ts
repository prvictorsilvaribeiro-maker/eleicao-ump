"use client";
import { useCallback, useEffect, useState } from "react";

/** Busca a URL a cada `ms` milissegundos (pausa com a aba em segundo plano). */
export function usePolling<T>(url: string, ms = 3000) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    try {
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) {
        setErro(j.erro ?? "Falha ao carregar.");
        if (r.status === 401 || r.status === 403) setDados(null);
        return;
      }
      setDados(j as T);
      setErro(null);
    } catch {
      setErro("Sem conexão. Tentando de novo…");
    }
  }, [url]);

  useEffect(() => {
    recarregar();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, ms);
    const aoVoltar = () => document.visibilityState === "visible" && recarregar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [recarregar, ms]);

  return { dados, erro, recarregar };
}

export async function postJson(url: string, corpo: unknown): Promise<string | null> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    if (r.ok) return null;
    const j = await r.json().catch(() => ({}));
    return j.erro ?? "Algo deu errado. Tente de novo.";
  } catch {
    return "Sem conexão. Tente de novo.";
  }
}
