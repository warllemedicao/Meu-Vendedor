import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { createCatalogHandler } from "./_shared/service.ts";

// Nenhuma operação de banco ou chave administrativa é necessária para consultar este catálogo.
const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
Deno.serve(createCatalogHandler({
  authenticate: async token => {
    const { data: { user }, error } = await auth.auth.getUser(token);
    return error ? null : user?.id ?? null;
  },
  accounts: () => Deno.env.get("MV_CATALOG_ACCOUNTS"),
}));
