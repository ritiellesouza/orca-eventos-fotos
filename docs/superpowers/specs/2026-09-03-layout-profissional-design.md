# Layout Profissional da Plataforma — Design

Data: 2026-09-03
Status: aprovado
Sub-projeto de: `docs/superpowers/specs/2026-08-26-plataforma-fotos-eventos-design.md`
Referência visual: banlek.com (estrutura de página — header, hero, rodapé
institucional), adaptada ao nosso modelo sem marketplace.

## 1. Objetivo

Reestruturar as páginas públicas (`/`, `/e/[slug]`, `/e/obrigado`) e dar um
resumo básico ao painel admin, pra plataforma parecer um sistema profissional
de venda de fotos — não só uma tela de busca solta. Referência de estrutura:
banlek.com (header, hero, seções institucionais, rodapé com dados da
empresa).

Confirmado explicitamente com o usuário (segunda vez): **não** é pivô de
marketplace. Sem conta de comprador, sem carrinho entre eventos, sem itens
de navbar tipo "Vender fotos"/"Criar conta"/"Entrar". O `BrandHeader`
continua só com a logo — sem links fictícios sem destino real.

## 2. Escopo

Dentro do escopo:
- `SiteFooter.tsx`: rodapé reutilizável com dados reais da Orca Mídias
- Home (`/`): vira página de vendas real (hero + "como funciona" + rodapé)
- `/e/[slug]`: adiciona `SiteFooter` no final (hoje termina sem rodapé)
- `/e/obrigado`: adiciona `SiteFooter`
- Painel admin (`/admin/events`): resumo no topo (contagem de eventos e
  fotos)

Fora do escopo:
- Contas de comprador, carrinho, "Vender fotos", login público — rejeitado
  explicitamente pelo usuário
- Busca global de eventos na home — não existe diretório público de
  eventos no nosso modelo (cada evento tem link próprio, diferente do
  Banlek); a home não ganha um campo de busca
- Links de navbar sem destino real (ex: "Serviços", "Ajuda")
- Rodapé no painel admin (ferramenta interna, não página de marketing)
- Mudança de lógica de negócio em qualquer página tocada

## 3. Arquitetura

Componente novo:

| Componente | Responsabilidade |
|---|---|
| `web/components/SiteFooter.tsx` | Rodapé com nome da marca, CNPJ, cidade, contato, Instagram |

Dados reais usados no rodapé (fornecidos pelo usuário, não fabricados):
- Empresa: Orca Mídias
- CNPJ: 53.731.640/0001-38
- Localização: Mairiporã - SP
- Contato: contato@orcamidias.com
- Instagram: @orcamidias (link para `https://instagram.com/orcamidias`)

`BrandHeader` não muda — continua só a logo, clicável pra home. Nenhum
link de navbar novo é adicionado (sem destino real sem marketplace).

`web/app/page.tsx` (home) é reescrita: hero (título + subtítulo explicando
o produto), seção "Como funciona" (3 passos), `SiteFooter`. CTA da home
aponta pro Instagram/e-mail de contato — não existe busca global pra
apontar.

`web/app/e/[slug]/page.tsx` e `web/app/e/obrigado/page.tsx` ganham
`<SiteFooter />` no final do JSX existente — nenhuma outra mudança
estrutural (banner, cartão de busca, modais, grade, checkout continuam
exatamente como estão).

`web/app/admin/events/page.tsx` ganha um resumo (`X eventos · Y fotos`)
no topo da lista, calculado a partir dos dados já carregados pela página
(sem nova chamada de API).

## 4. Fluxo

Sem mudança de fluxo de negócio em nenhuma página. É reestruturação de
apresentação:
1. Guest chega em `/` → vê hero explicando o produto → "como funciona" →
   rodapé com contato
2. Guest chega em `/e/[slug]` (link recebido do fotógrafo/evento) → fluxo
   de busca por selfie inalterado → rodapé no final da página
3. Pós-compra → `/e/obrigado` → mensagem de confirmação inalterada →
   rodapé no final
4. Admin em `/admin/events` → vê resumo de contagem no topo → lista de
   eventos inalterada abaixo

## 5. Tratamento de erros

Nenhum caminho de erro novo — é adição de conteúdo estático/institucional,
sem chamada de API nova (o resumo do admin usa dados já buscados pela
página).

## 6. Testes

- `SiteFooter.test.tsx`: renderiza nome da marca, CNPJ, cidade, e-mail de
  contato e link do Instagram com os valores corretos
- `page.test.tsx` (home, se ainda não existir): renderiza hero e "como
  funciona"; testes existentes (se houver) continuam passando
- `/e/[slug]` e `/e/obrigado`: testes existentes continuam passando sem
  alteração de asserção (adição de rodapé não deveria quebrar nenhuma
  query existente); se algum teste faz snapshot completo do DOM, ajustar
- Admin events: teste novo confirmando que o resumo mostra a contagem
  correta a partir da lista carregada

## 7. Itens em aberto (não bloqueiam este sub-projeto)

- Foto de capa real no `EventBanner` (já registrado como pendência no
  spec anterior)
- Ícone de marca (olho vazado) e favicon
