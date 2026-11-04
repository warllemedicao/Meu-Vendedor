import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Exportação estática para Cloudflare Pages; build normal preservado.
  ...(process.env.MEU_VENDEDOR_STATIC_EXPORT === "1" ? { output: "export" as const } : {}),
};

export default nextConfig;
