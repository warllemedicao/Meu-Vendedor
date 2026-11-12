import { getSupabase } from "@/lib/supabase/client";
export {
  browserTimeZone, formatPublicationDate, isoToLocalDateTime, localDateTimeToIso,
  publicationTimeZones,
} from "./publication-time";

export const publicationDestinations = [
  { id: "shopee_video", label: "Shopee Vídeo · ação manual" },
  { id: "pinterest", label: "Pinterest · ação manual" },
  { id: "tiktok_video", label: "TikTok · publicação assistida manual" },
  { id: "other_app", label: "Outro aplicativo · compartilhamento manual" },
] as const;

export type PublicationDestination = typeof publicationDestinations[number]["id"];
export type PublicationStatus = "draft" | "scheduled" | "awaiting_manual_action" | "processing" | "published" | "failed" | "cancelled";
export type PublicationAction = "share_handoff" | "manual_published" | "manual_failed";

export interface PublicationRecord {
  id: string;
  idempotency_key: string;
  product_id: string | null;
  product_title: string;
  source_marketplace: string;
  affiliate_url: string;
  publication_title: string;
  caption: string;
  hashtags: string;
  destination: PublicationDestination;
  media_path: string;
  media_type: string;
  media_filename: string;
  status: PublicationStatus;
  scheduled_at: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  attempts: PublicationAttempt[];
}

export interface PublicationAttempt {
  id: string;
  attempt_number: number;
  action: string;
  result: string;
  details: string;
  created_at: string;
}

export async function uploadPublicationMedia(userId: string, file: File): Promise<string> {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
    "video/mp4": "mp4", "video/webm": "webm",
  };
  const extension = extensions[file.type];
  if (!extension || file.size <= 0 || file.size > 100 * 1024 * 1024) {
    throw new Error("Use uma imagem ou vídeo compatível de até 100 MB.");
  }
  const client = getSupabase();
  if (!client) throw new Error("O armazenamento de publicações não está configurado.");
  const path = `${userId}/publications/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from("mv-video-assets").upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (error) throw new Error("Não foi possível salvar a mídia privada da publicação.");
  return path;
}

export async function publicationScheduleRequest(body: Record<string, unknown>): Promise<unknown> {
  const client = getSupabase();
  if (!client) throw new Error("O serviço de agendamento não está configurado.");
  const { data, error } = await client.functions.invoke("publication-schedule", { body });
  if (error) {
    let serverMessage = "";
    if (error.context instanceof Response) {
      try {
        const payload: unknown = await error.context.clone().json();
        if (payload && typeof payload === "object" && "error" in payload) {
          const issue = (payload as { error?: { message?: unknown } }).error;
          if (typeof issue?.message === "string") serverMessage = issue.message;
        }
      } catch { serverMessage = ""; }
    }
    if (serverMessage) throw new Error(serverMessage);
    throw new Error("Não foi possível salvar a publicação. Verifique a conexão e tente novamente.");
  }
  if (!data || typeof data !== "object") throw new Error("O serviço de agendamento retornou uma resposta inválida.");
  const payload = data as { error?: { message?: unknown } };
  if (payload.error && typeof payload.error.message === "string") throw new Error(payload.error.message);
  return data;
}

export function publicationStatusLabel(status: PublicationStatus): string {
  return {
    draft: "Rascunho",
    scheduled: "Agendada",
    awaiting_manual_action: "Aguardando ação manual",
    processing: "Em processamento",
    published: "Publicada · confirmada manualmente",
    failed: "Falhou",
    cancelled: "Cancelada",
  }[status];
}
