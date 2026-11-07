import { verifiedFreeAllowance, type FreeAllowance } from "./free-only.ts";

export interface ProductionReadiness {
  ready: boolean;
  imageReady: boolean;
  videoReady: boolean;
  checkedAt: string;
  message: string;
}

// Configuração permite tentar a API; não representa saldo nem gratuidade confirmados.
export function accountCreditReadiness(configured: (provider: string) => boolean): ProductionReadiness {
  const imageReady = configured("cloudflare-workers-ai");
  const videoReady = configured("onemin") || configured("magic-hour") || configured("google-gemini") || configured("replicate");
  return { ready: imageReady && videoReady, imageReady, videoReady, checkedAt: new Date().toISOString(),
    message: imageReady && videoReady
      ? "Serviços configurados para tentar a geração. O fornecedor verifica os créditos; a troca de serviço é automática quando possível."
      : "Faltam credenciais de imagem ou vídeo. O pedido pode aguardar na fila até a configuração estar disponível." };
}

// Não retorna saldos, evidências administrativas ou respostas de conta ao cliente.
export async function productionReadiness(
  configured: (provider: string) => boolean,
  allowance: (provider: string, model: string) => Promise<FreeAllowance | null>,
): Promise<ProductionReadiness> {
  async function eligible(provider: string, model: string, units: number): Promise<boolean> {
    if (!configured(provider)) return false;
    try {
      const grant = await allowance(provider, model);
      return verifiedFreeAllowance(grant, provider, model) && Number(grant!.remaining_units) >= units;
    } catch { return false; }
  }
  const [imageReady, magic, replicate] = await Promise.all([
    eligible("cloudflare-workers-ai", "@cf/black-forest-labs/flux-2-dev", 2819),
    eligible("magic-hour", "ltx-2.5", 144),
    eligible("replicate", "alibaba/happyhorse-1.0", 6),
  ]);
  const videoReady = magic || replicate;
  return {
    ready: imageReady && videoReady, imageReady, videoReady, checkedAt: new Date().toISOString(),
    message: imageReady && videoReady
      ? "Há cotas gratuitas verificadas para iniciar imagem e vídeo. O saldo será reservado novamente ao processar."
      : !imageReady && !videoReady
        ? "Imagem e vídeo ainda não têm cotas gratuitas liberadas. Seu pedido pode ser salvo na fila, mas não começará a gerar agora."
        : !imageReady
          ? "A geração da imagem inicial aguarda cota gratuita verificada. Uma imagem já pronta em cache pode ser reutilizada."
          : "A geração do vídeo aguarda cota gratuita verificada no Magic Hour ou Replicate.",
  };
}
