import "server-only";
import { createClient } from "@supabase/supabase-js";

function criar(url: string, key: string) {
  return createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: "eleicao" },
  });
}

let client: ReturnType<typeof criar> | null = null;

export function db() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.");
    }
    client = criar(url, key);
  }
  return client;
}
