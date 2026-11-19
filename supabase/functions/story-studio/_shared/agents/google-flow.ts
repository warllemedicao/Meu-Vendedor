// 4000 é limite de proteção definido pelo Meu Vendedor, não limite oficial do Flow.
export const googleFlowAgent = {
  name: "Google Flow",
  target: 2800,
  maximum: 4000,
  duration: "até 8 segundos quando for o limite do modelo selecionado",
  notes: "Preserve referências e identidade, mas não automatize UI nem altere o robô existente.",
} as const;
