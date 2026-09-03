# UX da Busca por Selfie no Padrão Banlek — Design

Data: 2026-08-31
Status: aprovado
Sub-projeto de: `docs/superpowers/specs/2026-08-31-identidade-visual-design.md`
Referência visual: banlek.com (ver conversa — cartão de busca, modais de
consentimento/captura, grade com checkbox)

## 1. Objetivo

Reorganizar a apresentação da página pública do evento (`/e/[slug]`) no padrão
visual usado por concorrentes como Banlek — banner com nome do evento, cartão
de busca central, fluxo em modais (consentimento → captura), grade de
resultado com checkbox visível e "Selecionar todas". **Zero mudança na lógica
de negócio**: mesma busca facial, mesmo consentimento LGPD real (só muda de
bloco solto pra modal), mesmo checkout, mesma seleção de fotos.

Confirmado explicitamente: **não** é pivô pra modelo de marketplace. Sem
conta de comprador, sem carrinho entre eventos, sem "Vender fotos" — o modelo
continua sendo só a Orca Mídias controlando upload, como já decidido no spec
original da plataforma.

## 2. Escopo

Dentro do escopo:
- Banner de topo no `/e/[slug]` com o nome do evento
- Cartão de busca (ícone + título + descrição + botão "Encontrar") substituindo
  o input de arquivo cru
- Modal de consentimento LGPD (mesmo texto de hoje, agora em popup)
- Modal de captura ("Carregar foto" / "Tirar foto")
- Checkbox visível em cada foto da grade + botão "Selecionar todas"

Fora do escopo:
- Contas de comprador, carrinho entre eventos, marketplace de fotógrafos
  terceiros (rejeitado explicitamente pelo usuário)
- Navbar com itens que não existem (Vender fotos, Criar conta) — a navbar
  continua só com a logo
- Mudança na lógica de `handleFile`, `handleCheckout`, `toggle`, consentimento
  real enviado ao servidor, ou qualquer chamada de API

## 3. Arquitetura

Componentes novos:

| Componente | Responsabilidade |
|---|---|
| `web/components/EventBanner.tsx` | Faixa colorida com o nome do evento |
| `web/components/ConsentModal.tsx` | Popup do texto de consentimento LGPD (já existente) + Cancelar/Estou de acordo |
| `web/components/CaptureModal.tsx` | Popup com "Carregar foto" / "Tirar foto" — dois inputs de arquivo escondidos (um sem `capture`, um com `capture="user"`), cada botão aciona o input correspondente |

`SelfieUploader.tsx` passa a orquestrar estado de qual modal está aberto
(`'none' | 'consent' | 'capture'`) além do estado que já tem hoje
(`consented`, `results`, `selected`, `email`, etc — nenhum desses muda de
nome ou de lógica). `handleFile` continua exatamente como está — só passa a
ser chamado a partir do `CaptureModal` em vez de um `<input>` direto na
página.

`PhotoGrid.tsx` ganha um indicador visual de checkbox no canto de cada foto
(elemento decorativo, reflete `isSelected` que já existe — não muda a lógica
de clique/seleção). "Selecionar todas" é um botão em `SelfieUploader.tsx`
(tem acesso a `results` e `setSelected` já hoje) que faz
`setSelected(new Set(results.map(r => r.photoId)))` — não precisa de prop
nova em `PhotoGrid`.

`web/app/e/[slug]/page.tsx` passa a selecionar também `name` do evento (hoje
só busca `id`) pra alimentar o `EventBanner` — única mudança de dado, o
resto da consulta/`notFound()`/`force-dynamic` continua igual.

## 4. Fluxo

1. Convidado abre `/e/[slug]` → vê `EventBanner` (nome do evento) + cartão de
   busca central
2. Clica "Encontrar" → se ainda não deu consentimento nesta sessão de
   componente, abre `ConsentModal`
3. "Estou de acordo" → fecha esse modal, abre `CaptureModal` ("Cancelar"
   fecha tudo, volta pro cartão)
4. Escolhe "Carregar foto" ou "Tirar foto" → aciona o input de arquivo
   correspondente → `handleFile` roda exatamente como hoje (mesma chamada
   pra `/api/events/[slug]/search`, mesmo tratamento de erro)
5. Resultado aparece na grade com checkbox visível por foto + "Selecionar
   todas" no topo
6. Resto do fluxo (seleção individual, checkout) inalterado

## 5. Tratamento de erros

Nenhum caminho de erro novo — os mesmos de hoje (`no_face_detected`, erro de
rede na busca, erro de checkout) continuam existindo e aparecendo do mesmo
jeito (`role="alert"`), só que agora dentro do layout novo.

## 6. Testes

- `EventBanner.test.tsx`: renderiza o nome do evento recebido por prop
- `ConsentModal.test.tsx`: renderiza o texto de consentimento; botão
  "Cancelar" dispara callback de fechar; "Estou de acordo" dispara callback
  de continuar
- `CaptureModal.test.tsx`: os dois botões existem; clicar cada um aciona o
  input de arquivo correspondente (testável via mock do `click()` do input
  ou verificando o atributo `capture` do input associado a cada botão)
- `SelfieUploader.test.tsx` (já existe, ganha casos novos): fluxo completo
  cartão → consentimento → captura → resultado continua funcionando; testes
  já existentes de erro/checkout continuam passando (só ajusta seletor se a
  estrutura DOM mudar, sem enfraquecer nenhuma asserção)
- `PhotoGrid.test.tsx` (se existir) ou teste novo: checkbox visual reflete
  `isSelected`

## 7. Itens em aberto (não bloqueiam este sub-projeto)

- Foto de capa real no banner (hoje é só cor sólida com o nome) — precisaria
  de um campo novo no evento (`cover_image_url` ou similar), fica pra depois
  se fizer sentido
