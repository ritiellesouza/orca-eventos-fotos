# Botão de Compra na Galeria — Design

Data: 2026-08-27
Status: aprovado
Sub-projeto de: `docs/superpowers/specs/2026-08-26-plataforma-fotos-eventos-design.md`

## 1. Objetivo

Fechar o fluxo de dinheiro da plataforma. Hoje o participante seleciona fotos na
galeria (`PhotoGrid`/`SelfieUploader`) mas nada chama `POST /api/checkout` — a
seleção não leva a lugar nenhum. `/api/checkout` já existe, é testado e funciona;
falta só o cliente chamá-lo.

## 2. Escopo

Dentro do escopo:
- Barra de checkout na página do evento, visível quando há fotos selecionadas
- Campo de e-mail do comprador (obrigatório, já é exigido pelo `/api/checkout`)
- Exibição do total (N fotos × preço) antes de redirecionar pro Stripe
- Redirecionamento pro Stripe Checkout e tratamento de erro

Fora do escopo (fica pra outros sub-projetos já identificados):
- Galeria geral / fotos sem rosto detectado
- Recuperação de link de download por e-mail
- Painel admin visual

## 3. Arquitetura

Nenhuma mudança de API. Só client-side:

| Arquivo | Mudança |
|---|---|
| `web/lib/pricing.ts` (novo) | função pura de formatação/cálculo de preço total |
| `web/lib/env.ts` | (já existe) usado pra ler `NEXT_PUBLIC_PHOTO_PRICE_CENTS` no cliente |
| `web/components/SelfieUploader.tsx` | adiciona estado de e-mail, barra de checkout condicional, chamada ao `/api/checkout` |
| `web/.env.local.example` | adiciona `NEXT_PUBLIC_PHOTO_PRICE_CENTS` |

## 4. Fluxo

1. Participante seleciona 1+ fotos na galeria (estado `selected` já existe)
2. Barra fixa aparece: "`N` fotos selecionadas · `R$ X,XX`" + campo de e-mail + botão "Comprar"
3. Botão fica desabilitado até o e-mail ter formato válido (checagem simples de regex, não substitui validação do Stripe)
4. Clique → `POST /api/checkout` com `{eventId, photoIds: [...selected], buyerEmail: email}`
5. Resposta `{url}` → `window.location.href = url` (sai da SPA, vai pro Stripe Checkout)
6. Stripe redireciona de volta pra `/e/obrigado?session_id=...` (já implementado, sem mudança)

## 5. Preço no cliente

`PHOTO_PRICE_CENTS` é lido hoje só no servidor (`checkout.ts`). Para mostrar o
total antes do pagamento, expõe uma cópia pública: `NEXT_PUBLIC_PHOTO_PRICE_CENTS`
(mesmo valor, prefixo `NEXT_PUBLIC_` pro Next.js injetar no bundle do cliente).
Isso é só exibição — o servidor nunca confia no preço vindo do cliente
(`buildCheckoutSession` já lê `PHOTO_PRICE_CENTS` do próprio servidor, ignora
qualquer coisa que viesse do body).

`web/lib/pricing.ts`:
```typescript
export function formatTotalBRL(unitPriceCents: number, count: number): string
```
Usa `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`. Testado
isolado (0 fotos, 1 foto, N fotos, formatação de centavos).

## 6. Tratamento de erro

- `response.status === 400` com `error: 'unknown_photo_ids'` → mensagem genérica:
  "Algumas fotos selecionadas não estão mais disponíveis. Atualize a página e tente de novo."
- Falha de rede / resposta não-JSON / qualquer outro erro → "Erro ao iniciar
  pagamento. Tente novamente." (segue o mesmo padrão de tratamento de erro já
  usado na busca por selfie, que já tem try/catch robusto)
- E-mail vazio ou sem formato válido → botão desabilitado, nenhuma chamada ao
  servidor (validação client-side é só UX, servidor já rejeita e-mail ausente)

## 7. Testes

- `web/lib/pricing.test.ts`: função pura, casos 0/1/N fotos, formatação de centavos
- `SelfieUploader.test.tsx` (já existe do trabalho anterior, ganha novos casos):
  barra de checkout não aparece com seleção vazia; aparece com seleção > 0 mostrando
  o total correto; botão desabilitado com e-mail inválido; clique com e-mail válido
  dispara `fetch('/api/checkout', ...)` com o payload correto (mock)

## 8. Itens em aberto (não bloqueiam este sub-projeto)

- Preço fixo por foto (`PHOTO_PRICE_CENTS`) continua sem suporte a pacote/desconto
  por volume — decisão de negócio já registrada como fora de escopo no spec original
