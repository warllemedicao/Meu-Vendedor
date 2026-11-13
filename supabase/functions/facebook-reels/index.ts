import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const respond = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const MAX_BYTES = 20 * 1024 * 1024;
const PAGE_ID = "1420652961139104";
const API_VERSION = "v27.0";
function failure(code: string, message: string, status = 400) {
  return respond(status, { ok: false, code, message });
}
async function graphResponse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    const code = typeof body.error?.code === "number" ? body.error.code : response.status;
    throw new Error("Meta API error (" + code + "): " + String(body.error?.message ?? "request failed").slice(0, 250));
  }
  return body;
}
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return failure("method_not_allowed", "Método não permitido.", 405);
  const legacyToken = Deno.env.get("META_PAGE_ACCESS_TOKEN");
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("authorization") ?? "";
  if (!url || !anon || !authorization.startsWith("Bearer ")) return failure("unauthorized", "Faça login para publicar.", 401);
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await client.auth.getUser(authorization.slice(7));
  if (error || !user || user.is_anonymous) return failure("unauthorized", "Sessão inválida.", 401);
  // Prefer the page explicitly authorized by this Supabase user through OAuth.
  let token: string | undefined;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const encryptionKey = Deno.env.get("META_TOKEN_ENCRYPTION_KEY");
  if (serviceKey && encryptionKey) {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: connection } = await admin.from("facebook_page_connections")
      .select("page_id,token_ciphertext,token_iv").eq("user_id", user.id).maybeSingle();
    if (connection?.page_id === PAGE_ID) {
      try {
        const decode = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));
        const keyBytes = decode(encryptionKey);
        if (keyBytes.byteLength !== 32) throw new Error("Invalid encryption key");
        const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
        const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(connection.token_iv) }, key, decode(connection.token_ciphertext));
        token = new TextDecoder().decode(clear);
      } catch { return failure("connection_invalid", "Reconecte o Facebook antes de publicar.", 409); }
    }
  }
  if (!token) {
    const allowedUserId = Deno.env.get("META_ALLOWED_USER_ID");
    if (!allowedUserId) return failure("owner_not_configured", "Configure META_ALLOWED_USER_ID no Supabase.", 503);
    if (user.id !== allowedUserId) return failure("forbidden", "Esta conta não está autorizada a publicar na Página.", 403);
    token = legacyToken;
  }
  if (!token) return failure("meta_not_configured", "Conecte o Facebook ou configure o token da Página.", 503);
  if (request.headers.get("content-length") && Number(request.headers.get("content-length")) > MAX_BYTES + 10000) {
    return failure("file_too_large", "MP4 deve ter no máximo 20 MB.", 413);
  }
  let form: FormData;
  try { form = await request.formData(); }
  catch { return failure("invalid_form", "Envie um formulário com o MP4.", 400); }
  const file = form.get("video");
  const description = form.get("description");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES ||
      file.type !== "video/mp4" || !file.name.toLowerCase().endsWith(".mp4")) {
    return failure("invalid_video", "Selecione um MP4 válido de até 20 MB.");
  }
  if (typeof description !== "string" || description.length > 2200) return failure("invalid_description", "Legenda inválida.");
  if (Deno.env.get("META_PAGE_ID") !== PAGE_ID) return failure("page_mismatch", "META_PAGE_ID não corresponde à Página autorizada.", 503);
  const base = `https://graph.facebook.com/${API_VERSION}/${PAGE_ID}/video_reels`;
  let videoId: string | undefined;
  try {
    const start = await graphResponse(await fetch(base, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ upload_phase: "start" }),
    }));
    videoId = start.video_id;
    if (typeof videoId !== "string" || !/^\d+$/.test(videoId) || typeof start.upload_url !== "string" ||
        !start.upload_url.startsWith("https://rupload.facebook.com/")) throw new Error("Meta não retornou uma sessão de upload válida.");
    const upload = await fetch(start.upload_url, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${token}`,
        offset: "0",
        file_size: String(file.size),
        "Content-Type": "application/octet-stream",
      },
      body: await file.arrayBuffer(),
    });
    await graphResponse(upload);
    // Meta accepts finish requests after upload, but processing/publication may be asynchronous.
    const finish = await graphResponse(await fetch(base, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ upload_phase: "finish", video_id: videoId, video_state: "PUBLISHED", description }),
    }));
    if (finish.success !== true) throw new Error("A Meta não confirmou a solicitação de publicação.");
    return respond(200, { ok: true, video_id: videoId, status: "submitted", message: "Envio concluído. Confira o Reel na Página para confirmar a publicação." });
  } catch (error) {
    // Never include access tokens, raw Meta responses or private video bytes in logs.
    const message = error instanceof Error ? error.message : "";
    const code = message.includes("Meta API error") ? "API" : null;
    return failure("meta_publish_failed", code ? `Meta recusou a operação (código ${code}). Verifique token, permissões e formato do vídeo.` : "Não foi possível concluir a publicação. Verifique a Página antes de tentar novamente.", 502);
  }
});
