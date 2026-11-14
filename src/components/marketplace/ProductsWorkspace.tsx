"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useMarketplace } from "./MarketplaceProvider";
import { ProductCatalog } from "./ProductCatalog";
import { PublicProductCatalog } from "./PublicProductCatalog";

/** Página Produtos: somente catálogo. A gestão de lojas e conexões pertence a Conta e conexões. */
export function ProductsWorkspace() {
  const { user, loading } = useAuth();
  const marketplace = useMarketplace();
  const connected = Boolean(user && marketplace.connections.some((connection) => connection.platform_id === "shopee" && connection.status === "connected"));

  if (loading || (user && marketplace.loading)) {
    return <p role="status">Carregando produtos…</p>;
  }

  return <div className="space-y-6">
    {connected && <section aria-label="Produtos da conta Shopee">
      <h2 className="mb-3 text-lg font-semibold">Produtos da minha conta</h2>
      <ProductCatalog />
    </section>}
    <section aria-label="Produtos da vitrine pública">
      <h2 className="mb-3 text-lg font-semibold">Explorar produtos</h2>
      <PublicProductCatalog excludeShopee={connected} />
    </section>
  </div>;
}
