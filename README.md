# Ticketeira: backend

API de uma bilheteria de eventos. Qualquer usuário pode organizar eventos e comprar
ingressos. Projeto de estudo, com foco em regras de negócio e concorrência,
encerrado no MVP. A interface web está no repositório `frontend-ticketeira`.

## Stack

- Node 26 + TypeScript, Fastify
- PostgreSQL + Prisma 8 (contract-first, `src/prisma/contract.prisma`)
- Zod (validação, tipos e OpenAPI de cada rota) + Swagger UI em `/docs`
- JWT (`@fastify/jwt`) com refresh token em cookie httpOnly; senhas com argon2
- Vitest + `fastify.inject()`, Biome

## Rodando localmente

Requisitos: Node 26.10 (`.node-version`), pnpm e Docker (ou OrbStack).

```bash
pnpm install
docker compose up -d          # Postgres 18 em localhost:5432
cp .env.example .env          # e preencha (ver abaixo)
pnpm migrate                  # aplica as migrations
pnpm dev                      # http://localhost:3000, docs em /docs
```

Variáveis de ambiente (validadas na inicialização, em `src/env.ts`):

| Variável | Obrigatória | Exemplo |
|---|---|---|
| `DATABASE_URL` | sim | `postgresql://dev:postgresdev@localhost:5432/dev` |
| `JWT_SECRET` | sim, 32+ caracteres | `openssl rand -base64 48` |
| `FRONTEND_ORIGIN` | não | `http://localhost:5173` (origem liberada no CORS) |
| `PORT` | não | `3000` |
| `LOG_LEVEL` | não | `info` |

## Testes

Os testes usam um banco separado, `ticketeira_test`, no mesmo container
(configurado em `vitest.config.ts`). Na primeira vez:

```bash
docker compose exec db createdb -U dev ticketeira_test
pnpm migrate --db postgresql://dev:postgresdev@localhost:5432/ticketeira_test
```

Depois, `pnpm test`. Cada teste cria dados únicos, então o banco não precisa ser
limpo entre execuções. Toda migration nova precisa ser aplicada nos dois bancos.

## Endpoints

🔒 = exige `Authorization: Bearer <accessToken>`.

| Método | Rota | |
|---|---|---|
| POST | `/users` | cadastro |
| GET | `/users/me` 🔒 | usuário logado |
| POST | `/auth/login` | devolve o access token e grava o cookie de refresh |
| POST | `/auth/refresh` | troca o cookie de refresh por um novo par (rotação) |
| POST | `/auth/logout` | revoga o refresh token e apaga o cookie |
| GET | `/events` | vitrine pública (`city`, `state`, `limit`, `offset`) |
| GET | `/events/:id` | detalhe público |
| POST | `/events` 🔒 | cria evento em rascunho (limite por tier) |
| GET | `/events/mine` 🔒 | eventos que eu organizo |
| PATCH | `/events/:id` 🔒 | edita (só o dono) |
| POST | `/events/:id/publish` 🔒 | rascunho → publicado |
| POST | `/events/:id/cancel` 🔒 | cancela |
| POST | `/events/:id/orders` 🔒 | compra um ingresso |
| GET | `/tickets/mine` 🔒 | meus ingressos |

Schemas completos em `/docs`.

## Regras de negócio

- Não há admin: o dono de um evento é quem o criou.
- Limite de eventos ativos por tier: `free` 2, `verified` 5, `pro` 8.
- Um ingresso por CPF por evento. Idade mínima conferida na data do evento
  (fuso de São Paulo).
- O preço do ingresso fica registrado no pedido no momento da compra.
- Evento só aparece na vitrine e só vende depois de publicado.

## Concorrência

- **Capacidade:** a compra trava a linha do evento (`SELECT ... FOR UPDATE`)
  dentro de uma transação. Compras simultâneas fazem fila, e nunca se vende além
  da capacidade. Há um teste que dispara 10 compras simultâneas para 5 lugares.
  `CHECK (sold_tickets <= capacity)` no banco é a última linha de defesa.
- **Limite do tier:** o mesmo padrão, travando a linha do usuário.
- **Refresh token:** a rotação é um `UPDATE` condicional. Reusar um token já
  usado revoga todas as sessões do usuário.

## Limitações conhecidas

- O access token (JWT) não é revogável: depois do logout, ele continua válido até
  expirar (no máximo 15 minutos). O refresh token, esse sim, é revogado na hora.
  Revogação imediata exigiria uma consulta ao banco em toda requisição.
- O `PATCH /events/:id` ainda não bloqueia mudanças em eventos com ingressos
  vendidos. A regra decidida (`minAge` só pode descer; `startsAt` e `location`
  não mudam depois da primeira venda, com 409) ficou de fora; o frontend não
  expõe edição de evento.
- Fora do escopo: pagamento (PIX), check-in e transferência de ingresso.

## Prisma

Depois de alterar `src/prisma/contract.prisma`:

```bash
pnpm contract:emit
pnpm migration:plan
pnpm migrate
```

Os scripts `composer:*`, `deploy` e `dev:composer` vieram do template
`create-prisma` e não fazem parte do fluxo do projeto.
