export type MotionJob = {
 id: string; engine: string; kind: "image" | "video"; status: string; url?: string;
 resultPath?: string; phase?: string; elapsed?: number; stepsCompleted?: number; stepsTotal?: number; error?: string; createdAt?: string;
};
export const motionActive = (job: MotionJob) => ["submitting", "running", "uncertain", "cancelling"].includes(job.status);
export const motionMessages: Record<string, string> = {
 input_review_required: "Os arquivos mudaram ou ainda não foram conferidos. Confira novamente as imagens antes de gerar.",
 prepared_reference_mismatch: "Esta imagem vestida não está vinculada ao mesmo produto e personagem. Escolha uma referência correspondente e revisada.",
 product_source_mismatch: "A foto não corresponde ao produto sincronizado selecionado.",
 unauthorized: "Entre novamente na sua conta.", motion_busy: "A GPU está atendendo outro pedido. Aguarde a conclusão.",
 motion_daily_limit: "A cota diária de testes foi atingida.", engine_unavailable: "Esta ferramenta ainda não pode ser executada.",
 input_invalid: "Confira os arquivos e as opções do pedido.", input_required: "Envie os arquivos necessários antes de gerar.",
 mask_required: "O modo VACE exige um vídeo de máscara: branco para editar e preto para preservar.",
 media_unavailable: "Um dos arquivos está indisponível. Envie-o novamente.", video_url_unsupported: "Este link não é um MP4 direto de uma origem suportada. Baixe o arquivo autorizado e envie pelo campo de vídeo.",
 video_url_invalid: "Informe um link HTTPS válido para um vídeo.", media_too_large: "O vídeo excede o limite de 40 MB.",
 video_invalid: "O conteúdo recebido não é um vídeo MP4 ou WebM.", quota_unavailable: "O Kaggle não confirmou ao menos uma hora disponível de GPU para este teste.",
 submission_uncertain: "O envio ainda não foi confirmado. Use Verificar entrega; não inicie outro pedido.",
 preparation_failed: "Não foi possível preparar o executor. Consulte o histórico antes de tentar novamente.",
 result_unavailable: "O arquivo está temporariamente indisponível. Atualize o acesso.", result_missing: "O executor encerrou sem entregar o arquivo.",
 gpu_memory_exhausted: "A GPU ficou sem memória. O resultado deste teste não foi concluído.",
 driver_too_short: "O vídeo-base precisa ter pelo menos a duração solicitada.", executor_failed: "O teste de GPU falhou. O diagnóstico técnico foi preservado.",
 workflow_validation_failed: "A configuração do modelo não foi aceita pelo executor. Este teste precisa de revisão técnica.",
 motion_unavailable: "Não foi possível consultar o serviço de movimento. Tente atualizar o histórico.",
 remote_status_unavailable: "O arquivo ainda não foi recebido e a consulta ao executor está indisponível. A tarefa foi preservada, sem novo envio.",
};
export const motionStates: Record<string, string> = { submitting: "Preparando executor", running: "Gerando", uncertain: "Envio em verificação", completed: "Concluído", failed: "Falhou", cancelling: "Cancelamento solicitado", cancelled: "Cancelado", expired: "Prazo encerrado" };
export const motionPhases: Record<string, string> = { dependencies: "Preparando ferramentas", models: "Carregando modelos", inference: "Animando personagem", tryon: "Aplicando a roupa", upload: "Salvando resultado", complete: "Resultado pronto", recovered: "Arquivo recuperado" };

export async function validateMotionFile(file: File, kind: "image" | "video") {
 const limit = (kind === "image" ? 10 : 40) * 1024 * 1024;
 if (!file.size || file.size > limit) throw new Error(`O arquivo deve ter até ${kind === "image" ? 10 : 40} MB.`);
 const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
 const video = String.fromCharCode(...bytes.slice(4, 8)) === "ftyp" || [0x1a, 0x45, 0xdf, 0xa3].every((v, i) => bytes[i] === v);
 const image = (bytes[0] === 0xff && bytes[1] === 0xd8) || [137, 80, 78, 71].every((v, i) => bytes[i] === v) || String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
 if (!(kind === "image" ? image : video)) throw new Error(kind === "image" ? "Use uma imagem JPEG, PNG ou WebP." : "Use um vídeo MP4 ou WebM.");
 return kind === "video" ? (bytes[0] === 0x1a ? "webm" : "mp4") : bytes[0] === 0xff ? "jpg" : bytes[0] === 137 ? "png" : "webp";
}
