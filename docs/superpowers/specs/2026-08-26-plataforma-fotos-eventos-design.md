# Plataforma de Fotos de Eventos com Reconhecimento Facial — Orca Mídias

Data: 2026-08-26
Status: aprovado (aguardando revisão final do usuário)
Referência de mercado: Clique Oficial (cliqueoficial.com.br), Banlek (banlek.com)

## 1. Objetivo

Plataforma web onde a Orca Mídias publica fotos de eventos (150-300 participantes,
~1.000 fotos por evento, 1-2 eventos/mês inicialmente) e cada participante encontra
suas próprias fotos enviando uma selfie, sem precisar de conta prévia. Compra é feita
via Stripe; após pagamento, a foto original em alta resolução é liberada para download.

Upload de fotos é controlado exclusivamente pela Orca Mídias (equipe recolhe os
cartões de memória dos fotógrafos do evento e sobe tudo pelo painel admin — mesmo
havendo múltiplos fotógrafos por evento, não há acesso de upload para terceiros).

## 2. Escopo (MVP)

Dentro do escopo:
- Painel admin (Orca Mídias) para criar evento e subir fotos em lote
- Processamento automático: geração de preview com marca d'água + indexação facial
- Busca de fotos por selfie, sem login
- Checkout Stripe e liberação de download em alta resolução pós-pagamento
- Consentimento LGPD para uso de dado biométrico (selfie)

Fora do escopo (não nesta fase):
- Múltiplos fotógrafos/clientes com upload próprio (multi-tenant)
- App mobile nativo
- Edição de fotos dentro da plataforma
- Bloqueio garantido de print/captura de tela (tecnicamente inviável — ver seção 6)

## 3. Arquitetura

| Camada | Escolha | Motivo |
|---|---|---|
| Frontend | Next.js | Padrão já usado pela agência (Estrategix); esta vez com investimento maior em design visual |
| Banco/Auth | Supabase self-hosted (VM G3 Mídia, Oracle) | Já roda na mesma VM (padrão schema-por-projeto do Conselho de Clones); schema novo `orca_eventos` |
| Busca vetorial | pgvector (extensão Postgres do próprio Supabase) | Guarda embeddings faciais (512-d) e faz busca por similaridade (cosine) sem banco separado |
| Reconhecimento facial | Microserviço Python (FastAPI) + InsightFace/ArcFace, self-hosted na VM G3 Mídia | Dado biométrico sensível (LGPD) fica no servidor próprio, sem custo por imagem, evita enviar rosto pra terceiro nos EUA |
| Storage de fotos | Cloudflare R2 (S3-compatible), fora da VM | Sem taxa de egress (compradores baixam foto em alta repetidamente); VM não comporta esse volume de storage a médio prazo |
| Pagamento | Stripe Checkout + webhook | Já decidido pelo usuário |

## 4. Fluxo de dados

### 4.1 Upload (admin, por evento)
1. Staff cria evento (nome, data, local)
2. Sobe fotos em lote (dos cartões de memória)
3. Para cada foto, pipeline assíncrono:
   - Gera preview comprimido (baixa resolução) com marca d'água sobreposta
   - Detecta rostos na foto (InsightFace)
   - Gera embedding (vetor 512-d) por rosto detectado
   - Salva vetor no pgvector, linkado à foto e ao evento
   - Sobe preview + original pro R2 (buckets/prefixos separados: `previews/` público, `originais/` privado)

### 4.2 Busca (participante, sem conta)
1. Acessa página pública do evento
2. Aceita termo de consentimento LGPD (uso de selfie para busca facial)
3. Tira/sobe uma selfie
4. Selfie vai pro microserviço facial → gera embedding
5. Busca no pgvector os vetores mais próximos **dentro do mesmo evento** (cosine similarity, threshold configurável)
6. Retorna grade de fotos: preview em baixa resolução + marca d'água

### 4.3 Compra
1. Participante seleciona fotos (avulsas) ou pacote (todas as suas fotos do evento)
2. Checkout Stripe
3. Webhook Stripe confirma pagamento
4. Gera signed URLs do R2 (expira em algumas horas) para os originais em alta resolução, sem marca d'água
5. Participante baixa

### 4.4 Camada extra de dissuasão (não é bloqueio garantido)
JS detecta perda de foco da janela (`blur`/`visibilitychange`) na tela de preview e aplica
blur CSS temporário — funciona contra ferramentas de captura desktop que roubam foco
(Ferramenta de Captura do Windows), **não funciona** contra tecla Print Screen isolada
nem contra print nativo de celular (iOS/Android não tira foco da janela).

## 5. Tratamento de erros

- **Foto sem rosto detectado**: fica indexada normalmente no evento (aparece na galeria geral), só não participa da busca por selfie
- **Selfie sem rosto detectado / rosto não reconhecido com confiança suficiente**: mensagem clara pedindo nova foto (boa iluminação, rosto de frente)
- **Zero resultados na busca**: sugerir busca manual por navegação na galeria completa do evento como alternativa
- **Falha no pagamento Stripe**: nenhuma signed URL é gerada; usuário pode tentar novamente; carrinho mantido
- **Signed URL expirada antes do download**: participante pode gerar novo link a partir do histórico de compra (precisa manter registro comprador↔fotos compradas no banco, sem exigir conta completa — vincular por e-mail/telefone usado no Stripe)

## 6. LGPD e privacidade

Rosto é dado biométrico sensível (LGPD art. 5º, II). Requisitos:
- Termo de consentimento explícito antes do upload da selfie, explicando finalidade (buscar fotos do evento) e que processamento é feito em servidor próprio (self-host, não third-party)
- Política de retenção: excluir embeddings faciais e selfies de busca após prazo definido (recomendado 90-180 dias após o evento) — fotos originais/compradas podem ter retenção separada, mais longa
- Participante pode solicitar exclusão dos próprios dados (selfie + embedding) a qualquer momento

## 7. Testes

- Unitário: geração de embedding (mock InsightFace), matching por similaridade (thresholds), geração de watermark
- Integração: pipeline upload→processamento→indexação; fluxo busca→resultado; webhook Stripe→liberação de signed URL
- Manual/E2E: teste com evento piloto pequeno (poucas fotos, poucos rostos) antes de subir volume real de 1.000 fotos

## 8. Estimativa de armazenamento e custo (ordem de grandeza)

- ~1.000 fotos/evento × ~5-8MB (alta res) ≈ 5-8GB original + ~1-1.5GB previews por evento
- 1-2 eventos/mês → ~10-16GB/mês crescendo no R2
- Cloudflare R2: ~US$0,015/GB/mês armazenamento, egress grátis → custo mensal irrisório nessa escala (poucos dólares)
- Reconhecimento facial self-host: sem custo por imagem, só custo fixo já existente da VM G3 Mídia
- Stripe: taxa padrão por transação (não há mensalidade)

## 9. Itens em aberto para a fase de implementação (não bloqueiam o design)

- Modelo de preço: por foto avulsa vs. pacote fechado do evento — decisão de negócio, não técnica
- Investimento em design visual elaborado do frontend (o usuário pediu explicitamente mais capricho que o Estrategix) — endereçar na fase de UI com skill de design dedicada
