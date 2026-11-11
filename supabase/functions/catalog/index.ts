import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { createCatalogHandler } from "./_shared/service.ts";

// Credenciais ficam exclusivamente nos Secrets do Supabase.
// ALIEXPRESS_API: JSON { "userId": "UUID_REAL", "appKey": "...", "appSecret": "...", "trackingId": "..." }.
// Nunca habilitar para todos os usuários: o userId é obrigatório e vincula o acesso ao titular.
function catalogAccounts(): string | undefined {
  const raw = Deno.env.get("MV_CATALOG_ACCOUNTS");
  const aliRaw = Deno.env.get("ALIEXPRESS_API");
  if (!aliRaw) return raw;
  let accounts: Record<string, unknown>;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("accounts");
    accounts = parsed as Record<string, unknown>;
    const ali: unknown = JSON.parse(aliRaw);
    if (!ali || typeof ali !== "object" || Array.isArray(ali)) throw new Error("aliexpress");
    const config = ali as Record<string, unknown>;
    const userId = config.userId;
    if (typeof userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) throw new Error("userId");
    const previous = accounts[userId];
    const userConfig = previous && typeof previous === "object" && !Array.isArray(previous) ? previous as Record<string, unknown> : {};
    // Configuração específica já existente prevalece sobre o alias opcional.
    accounts = { ...accounts, [userId]: { ...userConfig, aliexpress: userConfig.aliexpress ?? {
      appKey: config.appKey, appSecret: config.appSecret, trackingId: config.trackingId,
    } } };
    return JSON.stringify(accounts);
  } catch {
    // Falhar fechado: configuração inválida nunca libera credenciais a outra conta.
    return "{invalid-json";
  }
}

const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
Deno.serve(createCatalogHandler({
  authenticate: async token => {
    const { data: { user }, error } = await auth.auth.getUser(token);
    return error ? null : user?.id ?? null;
  },
  accounts: catalogAccounts,
}));
