# Identidade Visual Orca Mídias — Design

Data: 2026-08-31
Status: aprovado
Sub-projeto de: `docs/superpowers/specs/2026-08-26-plataforma-fotos-eventos-design.md`

## 1. Objetivo

Aplicar o design system da Orca Mídias (cores, tipografia, logo, estilo de botão)
em toda a plataforma — páginas públicas e painel admin — substituindo o
boilerplate padrão do `create-next-app` (fontes Geist, título "Create Next
App", `lang="en"`) que ainda está em produção.

Fonte da verdade do design system:
`D:\SERVIDOR TRABALHOS\Orca midias\ORCA IDENTIDADE VISUAL\Orca_Midias_Design_System.pdf`
(tokens confirmados pelo usuário em 2026-08-31, sem mudança desde jul/2026).

## 2. Escopo

Dentro do escopo:
- Tokens de cor e tipografia (Tailwind config + CSS global)
- Componentes compartilhados: `BrandHeader` (logo), `Button` (padrão de CTA)
- Aplicar em: `/` (nova página institucional), `/e/[slug]`, `/e/obrigado`,
  `/admin/login`, `/admin/events`, `/admin/events/[id]/upload`
- Corrigir metadata (título/descrição da aba) e `lang="pt-BR"`
- Trazer logo (`logopretohorizontal.png`) para `web/public/`

Fora do escopo:
- Redesenho de layout/UX (estrutura das telas continua a mesma, só ganha
  identidade visual)
- Ícone de marca (olho vazado) — só o logo horizontal por ora
- Fonte manuscrita Caveat usada além de um detalhe pontual na home

## 3. Tokens

**Cores** (Tailwind, prefixo `orca-`):

| Token | Hex | Uso |
|---|---|---|
| `orca-azul-escuro` | `#181E27` | Cabeçalho/nav, texto de destaque |
| `orca-royal` | `#18456B` | Links secundários |
| `orca-verde-agua` | `#44B494` | Ação primária (botões) |
| `orca-dourado` | `#DAA034` | Acento (bordas, hover, detalhes) |
| `orca-preto-marca` | `#2B2522` | Texto de corpo (não preto puro) |

Fundo do site: branco/neutro claro, fixo — remove a troca automática
claro/escuro por preferência do sistema operacional que existe hoje em
`web/app/globals.css` (a marca não tem modo escuro definido).

**Tipografia**: Montserrat via `next/font/google` (pesos 400, 600, 800 —
ExtraBold em títulos), substituindo as fontes Geist atuais. Caveat só como
detalhe manuscrito pontual na home (não em títulos de página nem botões).

**Botão**: radius `15px`, sombra `3px 3px 15px rgba(33,33,33,.66)`. Duas
variantes: primária (fundo `orca-verde-agua`, texto branco) e secundária
(contorno `orca-verde-agua`, texto `orca-verde-agua`).

## 4. Componentes novos

- `web/components/BrandHeader.tsx` — logo (`web/public/logo-orca-preto-horizontal.png`,
  já copiado) com `alt="Orca Mídias"`, usado no topo de toda página, pública e
  admin
- `web/components/Button.tsx` — `<Button variant="primary" | "secondary">`,
  aplica os tokens de radius/sombra/cor acima; usado em vez de `<button>` cru
  nas páginas que forem tocadas neste plano

## 5. Páginas

| Página | Mudança |
|---|---|
| `/` | Vira página institucional real: `BrandHeader`, frase curta explicando o produto, contato/Instagram da Orca Mídias — substitui o template do Next.js |
| `web/app/layout.tsx` | Fontes Montserrat/Caveat, `lang="pt-BR"`, metadata real (título/descrição do produto, não "Create Next App") |
| `/e/[slug]` (`SelfieUploader`, `PhotoGrid`) | `BrandHeader`, `Button` nos CTAs existentes (concordar consentimento, comprar), cores de fundo/texto nos tokens |
| `/e/obrigado` | `BrandHeader`, tokens de cor/tipografia |
| `/admin/login` | `BrandHeader`, `Button` no formulário |
| `/admin/events` | `BrandHeader`, `Button` nos CTAs (criar/salvar/apagar/sair) |
| `/admin/events/[id]/upload` | `BrandHeader`, `Button`, tokens na zona de arrastar-soltar |

Nenhuma mudança de comportamento/lógica nessas páginas — só classe CSS e
troca de `<button>` cru por `<Button>` onde já existe um botão.

## 6. Tratamento de erros

- Logo ausente/quebrado: `alt="Orca Mídias"` garante que o nome da marca
  ainda aparece por texto se a imagem falhar
- Sem outros novos caminhos de erro — é troca de estilo, não de lógica

## 7. Testes

- `Button.test.tsx`: variante primária/secundária aplicam as classes certas;
  continua disparando `onClick`/`type="submit"` normalmente
- `BrandHeader.test.tsx`: renderiza a imagem do logo com o `alt` certo
- Páginas existentes: testes já escritos continuam passando sem alteração de
  asserção (troca de classe CSS não quebra `getByRole`/`getByLabelText`,
  troca de `<button>` por `<Button>` mantém `role="button"`) — só ajustar se
  algum teste procurar por uma classe/tag específica que mudou

## 8. Itens em aberto (não bloqueiam este sub-projeto)

- Ícone de marca (olho vazado) e favicon
- Modo escuro com paleta própria da marca (hoje só existe modo claro fixo)
