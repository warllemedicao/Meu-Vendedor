import type { NextConfig } from "next";

// Falha antes do bundle se uma chave administrativa for colocada por engano no frontend.
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (Boolean(publicKey) !== Boolean(publicUrl)) {
  throw new Error("Configure juntas a URL e a chave publicável do Supabase.");
}
if (publicKey) {
  let isPublic = publicKey.startsWith("sb_publishable_");
  if (!isPublic && publicKey.startsWith("eyJ")) {
    try { isPublic = JSON.parse(Buffer.from(publicKey.split(".")[1], "base64url").toString()).role === "anon"; }
    catch { isPublic = false; }
  }
  if (!isPublic) throw new Error("Use somente uma chave publicável Supabase; chaves administrativas são proibidas no frontend.");
  try {
    const url = new URL(publicUrl!);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
  } catch { throw new Error("A URL pública do Supabase deve ser HTTPS e não conter credenciais."); }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Exportação estática para Cloudflare Pages; build normal preservado.
  ...(process.env.MEU_VENDEDOR_STATIC_EXPORT === "1"
    ? { output: "export" as const, images: { unoptimized: true } }
    : {}),
};

export default nextConfig;
