# Galeria Completa do Evento — Design

Data: 2026-09-13
Status: aprovado
Sub-projeto de: `docs/superpowers/specs/2026-08-26-plataforma-fotos-eventos-design.md`

## 1. Objetivo

Hoje, em `/e/[slug]`, o guest só vê fotos depois de buscar com selfie. Passa a
ver **todas as fotos do evento** já ao abrir a página, com opção de comprar
direto delas, sem precisar buscar. A busca por selfie continua existindo do
jeito que está hoje, como atalho pra filtrar só as fotos da própria pessoa.

Confirmado com o usuário: galeria e busca coexistem (não substituem uma à
outra); a pessoa pode comprar direto da galeria completa; a seleção e o
checkout são **compartilhados** entre galeria e busca — uma foto marcada na
galeria e outra marcada nos resultados da busca formam uma compra só.

## 2. Escopo

Dentro do escopo:
- `GET /api/events/[slug]/photos`: lista paginada de todas as fotos
  (prévias) do evento
- `EventGallery.tsx`: grade paginada ("Carregar mais") de todas as fotos,
  com checkbox + "Selecionar todas" (reaproveitando `PhotoGrid`)
- Seleção e checkout unificados entre `EventGallery` e a busca por selfie —
  extrai `CheckoutBar.tsx` (hoje embutido no `SelfieUploader`) e um
  componente pai `EventPageClient.tsx` que segura esse estado compartilhado
- `SelfieUploader.tsx` perde a lógica/UI de checkout (fica só com a busca:
  cartão, modais, resultados)
- `web/app/e/[slug]/page.tsx` passa a renderizar `EventPageClient` no lugar
  do `SelfieUploader` direto

Fora do escopo:
- Mudança na lógica de busca por selfie em si (`handleFile`, matching,
  threshold) — continua idêntica
- Mudança no checkout/Stripe/webhook — a API já aceita qualquer foto do
  evento, não só as vindas da busca (confirmado lendo `route.ts` atual)
- Filtros/ordenação avançados na galeria (por pasta, por horário) — só
  ordem cronológica de upload
- Contas de comprador, carrinho entre eventos — continua fora, como sempre

## 3. Arquitetura

Nova rota:

| Rota | Responsabilidade |
|---|---|
| `GET /api/events/[slug]/photos?offset=&limit=` | Lista prévias do evento em ordem de upload (`created_at asc`), paginada. Sem autenticação (mesma prévia pública já servida pelo R2). |

Resposta: `{ results: PhotoResult[], hasMore: boolean }`, mesmo formato
`PhotoResult` (`{ photoId, previewUrl }`) já usado pela busca — `previewUrl`
montada do mesmo jeito (`NEXT_PUBLIC_R2_PUBLIC_URL` + `storage_key_preview`).
Tamanho de página: 40. Rate limiter leve (mesmo padrão de
`web/lib/rateLimit.ts` já usado na busca) pra não virar scraper de galeria.

Componentes novos:

| Componente | Responsabilidade |
|---|---|
| `web/components/EventGallery.tsx` | Busca e mostra a primeira página de fotos ao montar; botão "Carregar mais" busca a próxima; "Selecionar todas" marca todas as fotos já carregadas. Não tem estado de seleção próprio — recebe `selected`/`onToggle`/`onSelectMany` por prop. |
| `web/components/CheckoutBar.tsx` | A barra sticky de compra (contagem, total, e-mail, botão Comprar, erro) extraída do `SelfieUploader` atual, agora recebendo tudo por prop — sem fetch próprio. |
| `web/components/EventPageClient.tsx` | Componente cliente que orquestra a página inteira: segura `selected`/`email`/`checkoutError`/`checkoutInFlight`/`handleCheckout` (lógica que hoje mora no `SelfieUploader`), renderiza `EventGallery` + `SelfieUploader` (sem checkout) + `CheckoutBar`. |

`SelfieUploader.tsx` muda de assinatura: recebe `selected`/`onToggle` por
prop em vez de ter estado próprio; perde `checkoutError`/`email`/
`checkoutInFlight`/`handleCheckout`/`pageshow`-listener/preço/`CheckoutBar`
JSX — tudo isso sobe pro `EventPageClient`. Continua dono de `consented`,
`modalOpen`, `results`, `error`, `handleFile`, `searching`.

`PhotoGrid.tsx` não muda — já recebe `selected`/`onToggle` por prop, exatamente
o que `EventGallery` precisa.

`web/app/e/[slug]/page.tsx`: troca `<SelfieUploader slug={} eventId={} />`
por `<EventPageClient slug={} eventId={} />` — resto da página (banner,
header, footer, `force-dynamic`, `notFound()`) inalterado.

## 4. Fluxo

1. Guest abre `/e/[slug]` → `EventGallery` já busca e mostra a primeira
   página de fotos do evento (todas, sem filtro)
2. Guest pode clicar "Carregar mais" pra ver mais fotos, ou "Selecionar
   todas" pra marcar as já carregadas
3. Guest pode também usar o cartão "Encontrar com selfie" (fluxo atual:
   consentimento → captura → resultados) — os resultados da busca aparecem
   junto, com sua própria grade
4. Selecionar uma foto em QUALQUER um dos dois blocos (galeria ou busca)
   atualiza o mesmo conjunto de seleção
5. A barra de compra (única, no fim da página) reflete o total combinado —
   uma única compra, seja a foto vinda da galeria ou da busca
6. Checkout segue exatamente igual a hoje (mesma API, mesma validação)

## 5. Tratamento de erros

- Falha ao carregar a primeira página da galeria: mensagem de erro com
  botão "Tentar novamente" (mesmo padrão de alerta `role="alert"` já usado)
- Falha ao "Carregar mais": mantém as fotos já carregadas na tela, mostra
  erro perto do botão, permite tentar de novo sem perder o que já tinha
- Rate limit da nova rota: mesma resposta `429` já usada na busca
- Nenhum caminho de erro novo no checkout — mesma lógica, mesma API

## 6. Testes

- Rota `GET /api/events/[slug]/photos`: pagina corretamente (`offset`/
  `limit`), `hasMore` correto no limite exato e fora dele, monta
  `previewUrl` igual à busca, 404 pra slug inexistente, rate limit
- `EventGallery.test.tsx`: carrega a primeira página ao montar; "Carregar
  mais" busca e concatena a próxima; "Selecionar todas" marca só as fotos
  já carregadas; erro de carregamento mostra alerta + retry
- `CheckoutBar.test.tsx`: os testes de barra de compra hoje em
  `SelfieUploader.test.tsx` migram pra cá, adaptados pra receber tudo por
  prop em vez de estado interno
- `EventPageClient.test.tsx` (novo): seleção feita na galeria e na busca
  (mockadas) aparece somada na mesma barra; checkout único dispara com os
  ids combinados
- `SelfieUploader.test.tsx`: mantém só os testes de fluxo de busca
  (consentimento, captura, erro de busca, "Selecionar todas" dos
  resultados) — os testes de checkout saem daqui

## 7. Itens em aberto (não bloqueiam este sub-projeto)

- Ordenação/filtro por pasta ou horário na galeria
- Miniatura da foto de capa no `EventBanner` (pendência antiga, ainda aberta)
