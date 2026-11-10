import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { createGalleryHandler } from "./service.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const auth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const storage = admin.storage.from("mv-video-assets");
Deno.serve(createGalleryHandler({
  authenticate: async token => { if (!token) return null; const { data, error } = await auth.auth.getUser(token); return error ? null : data.user?.id ?? null; },
  findProduct: async (owner, id) => {
    const { data, error } = await admin.from("mv_products").select("platform_id,shop_id,item_id,title,image_url").eq("user_id", owner).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? { platform: data.platform_id, shopId: data.shop_id, itemId: data.item_id, title: data.title, imageUrl: data.image_url } : null;
  },
  store: async (path, bytes, mime) => {
    const { data: existing } = await storage.download(path);
    const hash = async (input: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(input))), v => v.toString(16).padStart(2, "0")).join("");
    const expected = path.match(/-([a-f0-9]{64})\./)![1];
    if (existing && existing.size <= 5 * 1024 * 1024 && await hash(new Uint8Array(await existing.arrayBuffer())) === expected) return;
    if (existing) throw new Error("cached_photo_mismatch");
    const { error } = await storage.upload(path, bytes, { contentType: mime, upsert: false, cacheControl: "3600" });
    if (error) {
      const { data: concurrent } = await storage.download(path);
      if (!concurrent || concurrent.size > 5 * 1024 * 1024 || await hash(new Uint8Array(await concurrent.arrayBuffer())) !== expected) throw error;
    }
  },
}));
