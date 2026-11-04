import { createPublicCatalogHandler } from "../catalog/_shared/public-catalog.ts";

// Endpoint de vitrine pública, sem dados ou credenciais de usuários.
Deno.serve(createPublicCatalogHandler({ configuration: () => Deno.env.get("MV_PUBLIC_CATALOG_CONFIG") }));
