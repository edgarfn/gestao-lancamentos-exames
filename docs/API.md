# Referência da API

## Documentação interativa (Swagger/OpenAPI)

A forma recomendada de explorar e testar a API é a documentação interativa gerada
automaticamente a partir do código (`@nestjs/swagger`):

```
http://localhost:8080/api/v1/docs
```

> Disponível apenas fora de `NODE_ENV=production` (ver `backend/src/main.ts`) — em
> produção, a documentação interativa fica desabilitada por padrão como medida de
> redução de superfície exposta. Caso seja necessária em produção, habilite-a
> deliberadamente e proteja o caminho com autenticação adicional.

Esta página resume as convenções e os recursos disponíveis; a especificação completa
(schemas de request/response, exemplos, códigos de erro) está sempre no Swagger, gerado
diretamente do código — único lugar onde a referência nunca fica desatualizada.

## Convenções gerais

- **Prefixo e versionamento**: todas as rotas vivem sob `/api/v1/...`
  (`setGlobalPrefix('api')` + versionamento por URI com versão padrão `1`).
- **Autenticação**: Bearer JWT no cabeçalho `Authorization: Bearer <token>`, exceto
  nas rotas explicitamente públicas (`/auth/login`, `/auth/refresh`, `/health`).
- **Formato de payload**: JSON. Requisições com campos não declarados no DTO
  correspondente são **rejeitadas** (`whitelist`/`forbidNonWhitelisted`).
- **Paginação**: listagens aceitam `pagina` e `tamanhoPagina`, retornando um envelope
  com itens, total, página atual e tamanho de página.
- **Erros**: seguem o formato padrão do NestJS (`statusCode`, `message`, `error`);
  mensagens de autenticação são deliberadamente genéricas (não revelam se o problema
  foi o e-mail ou a senha).

## Recursos e papéis exigidos

A tabela abaixo resume **quem pode chamar o quê** — a referência definitiva de
parâmetros e schemas está no Swagger.

### Autenticação (`/auth`) — públicas ou autenticadas, sem papel específico

| Método | Rota                  | Acesso                                | Descrição                                                            |
| ------ | --------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| POST   | `/auth/login`         | Público                               | Autentica com e-mail/senha; retorna par de tokens (access + refresh) |
| POST   | `/auth/refresh`       | Público (requer refresh token válido) | Renova o token de acesso                                             |
| POST   | `/auth/logout-all`    | Autenticado                           | Encerra todas as sessões do usuário (incrementa `versaoSessao`)      |
| POST   | `/auth/alterar-senha` | Autenticado                           | Troca a própria senha; encerra as demais sessões automaticamente     |

### Lançamentos (`/lancamentos`) — núcleo funcional

| Método | Rota                        | Papéis                 | Descrição                                                                                                                                                                            |
| ------ | --------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/lancamentos`              | ADMIN, GESTOR, TECNICO | Cria um lançamento (técnicos apenas para si próprios)                                                                                                                                |
| GET    | `/lancamentos`              | Autenticado            | Lista com filtros — `exameId`, `tecnicoId`, `pacienteId`, `dataInicio`, `dataFim`, paginação e ordenação (`ordenarPor`: `data`, `-data`, `criadoEm`, `-criadoEm`, `valor`, `-valor`) |
| GET    | `/lancamentos/resumo`       | Autenticado            | Totais agregados (registros, quantidade, valor) para o filtro informado                                                                                                              |
| GET    | `/lancamentos/:id`          | Autenticado            | Detalhe de um lançamento                                                                                                                                                             |
| PATCH  | `/lancamentos/:id`          | ADMIN, GESTOR, TECNICO | Atualiza um lançamento (técnicos apenas os seus)                                                                                                                                     |
| DELETE | `/lancamentos/:id`          | ADMIN, GESTOR          | Remove (soft delete) um lançamento                                                                                                                                                   |
| GET    | `/lancamentos/exportar/csv` | ADMIN, GESTOR          | Exporta em CSV os lançamentos que correspondem ao filtro informado; gera registro de auditoria `EXPORTACAO`                                                                          |

> Os filtros de `GET /lancamentos` implementam exatamente os critérios solicitados:
> **exame, técnico, data (intervalo `dataInicio`/`dataFim`) e paciente** — todos
> validados (UUID/ISO-date) antes de chegar ao banco.

### Cadastros — Técnicos (`/tecnicos`)

| Método | Rota            | Papéis        | Descrição                       |
| ------ | --------------- | ------------- | ------------------------------- |
| POST   | `/tecnicos`     | ADMIN, GESTOR | Cadastra um técnico             |
| GET    | `/tecnicos`     | Autenticado   | Lista/busca técnicos (paginado) |
| GET    | `/tecnicos/:id` | Autenticado   | Detalhe de um técnico           |
| PATCH  | `/tecnicos/:id` | ADMIN, GESTOR | Atualiza um técnico             |
| DELETE | `/tecnicos/:id` | ADMIN         | Remove (soft delete) um técnico |

### Cadastros — Pacientes (`/pacientes`)

| Método | Rota                        | Papéis                 | Descrição                                                                               |
| ------ | --------------------------- | ---------------------- | --------------------------------------------------------------------------------------- |
| POST   | `/pacientes`                | ADMIN, GESTOR, TECNICO | Cadastra um paciente                                                                    |
| GET    | `/pacientes`                | Autenticado            | Lista/busca pacientes (paginado; busca por nome ou documento)                           |
| GET    | `/pacientes/:id`            | Autenticado            | Detalhe de um paciente                                                                  |
| PATCH  | `/pacientes/:id`            | ADMIN, GESTOR          | Atualiza um paciente                                                                    |
| DELETE | `/pacientes/:id`            | ADMIN                  | Remove (soft delete) um paciente                                                        |
| POST   | `/pacientes/:id/anonimizar` | ADMIN                  | Aciona manualmente a anonimização de um paciente (fora do ciclo automático de retenção) |

### Cadastros — Exames (`/exames`)

| Método | Rota          | Papéis        | Descrição                     |
| ------ | ------------- | ------------- | ----------------------------- |
| POST   | `/exames`     | ADMIN, GESTOR | Cadastra um exame no catálogo |
| GET    | `/exames`     | Autenticado   | Lista/busca exames (paginado) |
| GET    | `/exames/:id` | Autenticado   | Detalhe de um exame           |
| PATCH  | `/exames/:id` | ADMIN, GESTOR | Atualiza um exame             |
| DELETE | `/exames/:id` | ADMIN         | Remove (soft delete) um exame |

### Usuários do sistema (`/usuarios`) — somente ADMIN

| Método | Rota                            | Descrição                                                                   |
| ------ | ------------------------------- | --------------------------------------------------------------------------- |
| POST   | `/usuarios`                     | Cria uma conta de usuário (define papel)                                    |
| GET    | `/usuarios`                     | Lista usuários (paginado)                                                   |
| GET    | `/usuarios/:id`                 | Detalhe de um usuário                                                       |
| PATCH  | `/usuarios/:id`                 | Atualiza dados/papel/status de um usuário                                   |
| POST   | `/usuarios/:id/redefinir-senha` | Gera uma nova senha temporária para o usuário e encerra suas sessões ativas |

### Observabilidade

| Método | Rota      | Acesso  | Descrição                                                                                |
| ------ | --------- | ------- | ---------------------------------------------------------------------------------------- |
| GET    | `/health` | Público | Health check agregado (banco de dados, memória) — usado por orquestradores/monitoramento |

## Exemplo — autenticação e primeira chamada

```bash
# 1. Login
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@exames.local","senha":"<senha-temporaria-do-seed>"}'

# Resposta: { "accessToken": "...", "refreshToken": "...", "usuario": { ... } }

# 2. Chamada autenticada
curl http://localhost:8080/api/v1/lancamentos?pagina=1&tamanhoPagina=20 \
  -H 'Authorization: Bearer <accessToken>'

# 3. Consulta filtrada (exame + período)
curl "http://localhost:8080/api/v1/lancamentos?exameId=<uuid>&dataInicio=2026-06-01&dataFim=2026-06-30" \
  -H 'Authorization: Bearer <accessToken>'
```
