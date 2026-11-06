import type { VideoConfiguration, VideoGenerationStatus } from "@/lib/video-studio";

export interface VideoProviderCapabilities {
  id: "mock" | "google-gemini";
  name: string;
  available: boolean;
  model: string | null;
  supportsReferenceImages: boolean;
  supportsNativeAudio: boolean;
  supportsLipSync: boolean | null;
  supportsCostEstimate: boolean;
  message: string;
}

export interface VideoGenerationRequest {
  configuration: VideoConfiguration;
  script: string;
  prompt: string;
}

export interface VideoGenerationJob {
  id: string;
  status: VideoGenerationStatus;
  resultUrl: string | null;
  simulated: boolean;
  progress?: number | null;
  resultStoragePath?: string | null;
  errorCode?: string | null;
}

export interface AsyncVideoProcessorRequest {
  jobId: string;
  userId: string;
  requestData: Record<string, unknown>;
}

export interface AsyncVideoProcessorStatus {
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  providerJobId: string;
  resultObjectPath?: string | null;
  errorCode?: string | null;
}

export interface AsyncVideoProcessor {
  submit(request: AsyncVideoProcessorRequest): Promise<{ providerJobId: string }>;
  status(providerJobId: string): Promise<AsyncVideoProcessorStatus>;
  cancel(providerJobId: string): Promise<void>;
}

export interface VideoGenerationProvider {
  capabilities(): Promise<VideoProviderCapabilities>;
  validate(request: VideoGenerationRequest): string | null;
  estimateCost(request: VideoGenerationRequest): Promise<number | null>;
  start(request: VideoGenerationRequest): Promise<VideoGenerationJob>;
  status(jobId: string): Promise<VideoGenerationJob>;
}

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export const mockVideoProvider: VideoGenerationProvider = {
  async capabilities() {
    return {
      id: "mock",
      name: "Simulador local",
      available: true,
      model: null,
      supportsReferenceImages: true,
      supportsNativeAudio: false,
      supportsLipSync: false,
      supportsCostEstimate: true,
      message: "Simula o fluxo e salva as configurações. Não gera nem apresenta um MP4 fictício.",
    };
  },
  validate(request) {
    if (!request.prompt.trim() || !request.script.trim()) return "Roteiro e instruções são obrigatórios.";
    return null;
  },
  async estimateCost() {
    return 0;
  },
  async start() {
    await wait(450);
    return { id: `mock-${crypto.randomUUID()}`, status: "generating", resultUrl: null, simulated: true };
  },
  async status(jobId) {
    await wait(650);
    return { id: jobId, status: "processing", resultUrl: null, simulated: true };
  },
};

export const googleVideoProvider: VideoGenerationProvider = {
  async capabilities() {
    return {
      id: "google-gemini",
      name: "Google Gemini API",
      available: false,
      model: "gemini-omni-1.2-flash",
      supportsReferenceImages: true,
      supportsNativeAudio: true,
      supportsLipSync: null,
      supportsCostEstimate: false,
      message: "A geração Google usa a fila autenticada no backend. Este adaptador local não inicia chamadas de IA.",
    };
  },
  validate() {
    return "A geração real está desativada até a configuração do provedor oficial.";
  },
  async estimateCost() {
    return null;
  },
  async start() {
    throw new Error("google_provider_disabled");
  },
  async status() {
    throw new Error("google_provider_disabled");
  },
};
