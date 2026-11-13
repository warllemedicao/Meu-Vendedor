export const homePlatforms = [
  { id: "shopee", name: "Shopee" },
  { id: "amazon", name: "Amazon" },
  { id: "tiktok", name: "TikTok Shop" },
] as const;

export function getPublicCatalogSources(platformFilter?: string, excludeShopee = false) {
  return homePlatforms.filter(source =>
    (platformFilter === undefined || platformFilter === "all" || source.id === platformFilter) &&
    (!excludeShopee || source.id !== "shopee"),
  );
}
