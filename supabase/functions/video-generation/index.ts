import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { createVideoGenerationHandler } from "./_shared/service.ts";

const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(createVideoGenerationHandler({
  authenticate: async (token) => {
    const { data: { user }, error } = await auth.auth.getUser(token);
    return error ? null : user?.id ?? null;
  },
  googleApiKey: () => Deno.env.get("GOOGLE_GEMINI_API_KEY"),
  googleEnabled: () => Deno.env.get("MV_GOOGLE_VIDEO_ENABLED") === "true",
}));
