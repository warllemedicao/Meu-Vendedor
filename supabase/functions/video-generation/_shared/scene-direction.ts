const scenes: Record<string, string> = {
  "fashion-studio": "showroom de moda real, com arara de roupas organizada, espelho lateral e iluminação suave de janela",
  "everyday-outfit": "sala de estar real, com sofá, planta e janela iluminada ao fundo",
  "beauty-counter": "ambiente de beleza elegante, com bancada, espelho e armários ao fundo, luz natural suave",
  "neutral-product-table": "estúdio de produto com mesa de madeira, prateleira e planta ao fundo",
  "electronics-studio": "escritório moderno com mesa, monitor desfocado sem texto e iluminação de janela",
  "cleaning-kitchen": "cozinha real com bancada, pia e armários organizados ao fundo",
  "bathroom-counter": "banheiro real com bancada, cuba, azulejos e espelho sem reflexos de outras pessoas",
};
export function sceneDirection(sceneId: unknown): string {
  const scene = scenes[String(sceneId)] ?? scenes["neutral-product-table"];
  return `Ambiente obrigatório: ${scene}. Mostre o ambiente reconhecível atrás do apresentador e do produto, com profundidade, sombras coerentes e proporções reais. Substitua os fundos das fotos de referência; não copie fundo branco de catálogo e não use fundo vazio. Use plano médio aberto ou corpo inteiro quando necessário para mostrar a peça, sem esconder o produto.`;
}
