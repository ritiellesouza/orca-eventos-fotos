# Painel Admin Visual — Design

Data: 2026-08-27
Status: aprovado
Sub-projeto de: `docs/superpowers/specs/2026-08-26-plataforma-fotos-eventos-design.md`

## 1. Objetivo

Hoje o staff da Orca Mídias cria eventos e sobe fotos via `curl` direto contra
`/api/admin/events` e `/api/admin/events/[id]/photos` (rotas já implementadas,
testadas e protegidas por `ADMIN_TOKEN`). Este sub-projeto adiciona uma
interface visual no navegador pra essas mesmas operações, mais editar e
apagar evento — sem tocar no fluxo público (`/e/[slug]`, busca por selfie,
checkout, webhook), que já está em produção.

## 2. Escopo

Dentro do escopo:
- Login por senha compartilhada (o próprio `ADMIN_TOKEN`), sessão via cookie
- Lista de eventos com contagem de fotos
- Criar evento (reusa `POST /api/admin/events`, já existe)
- Editar evento (nome/data) — rota nova
- Apagar evento — rota nova, só remove do banco (cascade cuida de
  fotos/faces/compras); arquivos no R2 ficam órfãos, limpeza é item futuro
- Upload de fotos por evento (reusa `POST /api/admin/events/[id]/photos`,
  já existe) com resultado por arquivo (sucesso/falha)

Fora do escopo:
- Contas individuais por membro da equipe (login único compartilhado, como já
  decidido)
- Limpeza automática de arquivos órfãos no R2 ao apagar evento
- Edição/exclusão de fotos individuais dentro de um evento

## 3. Arquitetura

| Camada | Mudança |
|---|---|
| `web/middleware.ts` | matcher passa a cobrir também `/admin/:path*`; aceita **Bearer OU cookie** válido pra `/api/admin/*`; página `/admin/*` sem cookie válido redireciona pra `/admin/login` em vez de JSON 401 |
| `web/app/api/admin/login/route.ts` (novo) | `POST` compara senha recebida com `ADMIN_TOKEN` (mesma comparação de tempo constante já usada em `middleware.ts`); se bater, seta cookie httpOnly com o próprio valor do token |
| `web/app/api/admin/events/route.ts` | ganha `GET` (lista eventos + contagem de fotos via `photos(count)` do PostgREST) — `POST` existente não muda |
| `web/app/api/admin/events/[id]/route.ts` (novo) | `PATCH` (editar nome/data) e `DELETE` (apagar evento) |
| `web/app/admin/login/page.tsx` (novo) | formulário de senha |
| `web/app/admin/events/page.tsx` (novo) | lista + criar/editar/apagar evento |
| `web/app/admin/events/[id]/upload/page.tsx` (novo) | upload de fotos com drag-and-drop |

Cookie: `httpOnly`, `secure`, `sameSite: 'lax'`, valor = o próprio
`ADMIN_TOKEN` (sem tabela de sessão — mesmo modelo de segredo único já usado
pelas rotas de API, só que carregado via cookie em vez de header pra
requisições vindas do navegador).

## 4. Fluxo de dados

1. Staff acessa `/admin/events` sem cookie válido → middleware redireciona
   pra `/admin/login`
2. Login: `POST /api/admin/login` com a senha → cookie setado → redireciona
   pra `/admin/events`
3. Lista carrega via `GET /api/admin/events` (nome, slug, data, contagem de
   fotos por evento)
4. Criar evento: form/modal → `POST /api/admin/events` (já existe,
   inalterado) → atualiza lista
5. Editar: form → `PATCH /api/admin/events/[id]` → atualiza lista
6. Apagar: confirmação → `DELETE /api/admin/events/[id]` → remove da lista
7. Upload: clica no evento → `/admin/events/[id]/upload` → arrasta fotos →
   `POST /api/admin/events/[id]/photos` (já existe, inalterado) → mostra
   `{uploaded: [...], failed: [...]}` por arquivo

## 5. Tratamento de erros

- Senha errada: mensagem genérica ("senha incorreta"), nunca revela se
  `ADMIN_TOKEN` está configurado ou não
- `ADMIN_TOKEN` não configurado no servidor: login sempre falha com o mesmo
  erro genérico (mesma postura fail-closed do middleware atual)
- `PATCH`/`DELETE` em evento com id inexistente: `404`
- Cookie ausente/expirado/inválido em página `/admin/*`: redireciona pro
  login (não mostra JSON cru pro usuário)
- Cookie ausente/inválido em rota `/api/admin/*`: continua `401` JSON (igual
  hoje, cobre tanto curl quanto chamadas do próprio painel se o cookie
  expirar no meio de uma sessão)
- Upload de foto: comportamento já existente e já testado (isolamento por
  arquivo), sem mudança

## 6. Testes

- `middleware.test.ts`: aceita Bearer válido OU cookie válido; rejeita os
  dois quando errados/ausentes; página `/admin/*` sem auth redireciona (não
  retorna JSON)
- `POST /api/admin/login`: senha certa seta cookie e retorna sucesso; senha
  errada retorna erro genérico sem setar cookie
- `GET /api/admin/events`: retorna lista com contagem de fotos correta
  (mockado)
- `PATCH`/`DELETE /api/admin/events/[id]`: casos de sucesso e "não
  encontrado" (mockado)
- Componentes: login redireciona após sucesso; lista renderiza eventos;
  form de criar/editar valida campos obrigatórios antes de enviar

## 7. Itens em aberto (não bloqueiam este sub-projeto)

- Limpeza de arquivos órfãos no R2 quando um evento é apagado — fica pra
  quando o volume justificar a complexidade
- Múltiplas contas de staff com login individual — não é necessário na
  escala atual (1-2 eventos/mês, equipe pequena)
