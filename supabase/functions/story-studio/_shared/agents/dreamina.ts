// 4000 é limite conservador interno; o limite oficial varia com o modelo.
export const dreaminaAgent = {
  name: "Dreamina",
  target: 650,
  maximum: 1200,
  duration: "conforme modo e duração realmente disponíveis no gerador",
  notes: "Prompt direto, idealmente entre 30 e 100 palavras: personagem e referência visual (se anexada), uma ação concreta, câmera, ambiente e estilo, áudio/fala em português brasileiro somente se o modelo escolhido suportar. Se usar imagem de referência, concentre texto em movimento, sem redescrever detalhes já visíveis. Não presuma recursos ou duração de todos os modelos.",
} as const;
