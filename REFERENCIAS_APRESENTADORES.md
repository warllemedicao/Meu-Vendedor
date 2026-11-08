# Referências dos apresentadores — 08/11/2026

Carla e Rafael agora têm referências fotográficas próprias, plus size, com personagens adultos fictícios. Foram geradas pela ferramenta integrada de imagens e revisadas visualmente. As imagens anteriores foram preservadas como histórico; o aplicativo utiliza as variantes v2.

| Personagem | Arquivo público | Voz Google fixa |
|---|---|---|
| Ana | `/presenters/ana.webp` | Aoede |
| Lucas | `/presenters/lucas.webp` | Puck |
| Carla | `/presenters/carla-v2.webp` | Kore |
| Rafael | `/presenters/rafael-v2.webp` | Charon |

As variantes v2 têm 720×1280. O recorte dos cartões usa alinhamento superior para preservar cabelo e rosto. O envio às ferramentas aceita os quatro arquivos específicos; caminhos arbitrários continuam recusados.

## Banco de dados

`mv_presenter_profiles` guarda nome, biotipo, identidade visual, imagem versionada, SHA-256, voz fixa, preferências e procedência. Apenas o backend pode alterar o catálogo. Usuários autenticados leem perfis visualmente aprovados. Testes conferem os hashes dos arquivos e a correspondência entre banco e interface.

`mv_presenter_assets` continua sendo o catálogo privado de bases para sincronização, com recorte, cenário e aprovação próprios. Aprovar uma fotografia não aprova automaticamente qualquer vídeo produzido a partir dela.

`mv_presenter_validations` preserva relatórios técnicos por execução, sem acesso direto dos clientes. Não armazena credenciais nem URLs assinadas nos relatórios versionados.

## Prompts de geração

Ferramenta: geração integrada de imagens, sem CLI/API externa.

### Carla

Use case: photorealistic-natural. Asset type: vertical presenter reference photograph for a Portuguese-language commerce video application. Create one fictional human, Adult Brazilian Black woman age 35, visibly plus-size with naturally full torso, arms and rounded face, dark curly hair elegantly tied up, emerald green blouse, discreet earrings. Extremely lifelike photographic skin with pores, natural asymmetry, realistic eyes and hair, no beauty-filter plastic skin. Front facing, relaxed closed lips, friendly neutral expression looking into camera. Waist-up framing showing the full breadth of the plus-size body without cropping shoulders or arms, face near upper center, hands resting naturally below torso. Soft diffuse studio daylight, simple light warm gray background. Vertical 9:16 composition. No text, watermark, logos, collage, other people, cartoon or illustration. Clearly adult. Save generated image artifact for use in this repository.

### Rafael

Use case: photorealistic-natural. Asset type: vertical presenter reference photograph for a Portuguese-language commerce video application. Create one fictional human, Adult Brazilian man age 40, visibly plus-size with broad full torso and rounded face, light brown skin, short dark hair with some gray strands, terracotta polo shirt. Extremely lifelike photographic skin with pores, natural asymmetry, realistic eyes and hair, no beauty-filter plastic skin. Front facing, relaxed closed lips, friendly neutral expression looking into camera. Waist-up framing showing the full breadth of the plus-size body without cropping shoulders or arms, face near upper center, hands resting naturally below torso. Soft diffuse studio daylight, simple light warm gray background. Vertical 9:16 composition. No text, watermark, logos, collage, other people, cartoon or illustration. Clearly adult. Save generated image artifact for use in this repository.

## Limites

As fotografias são referências de identidade, não vídeos de movimento corporal. O fluxo de fala mantém corpo, roupa e ambiente da base; a foto do produto é exibida em um cartão separado. Trocar roupa ou cenário exige outra base adequada. Licenças de modelos, serviços e materiais externos continuam próprias de cada etapa; a geração destas referências não concede direitos sobre marcas ou imagens de terceiros.
