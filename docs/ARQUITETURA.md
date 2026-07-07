# Arquitetura

## Visão geral

```
┌─────────────┐      HTTPS/HTTP      ┌──────────────────────┐
│  Navegador  │ ───────────────────▶ │  frontend (Nginx)    │
└─────────────┘                      │  - serve a SPA React │
                                      │  - proxy /api/ ──┐   │
                                      └──────────────────│───┘
                                                         ▼
                                      ┌──────────────────────┐
                                      │  backend (NestJS)    │
                                      │  - REST API /api/v1  │
                                      │  - Auth/RBAC/Audit   │
                                      │  - CryptoService     │
                                      └──────────┬───────────┘
                                                 │ Prisma ORM
                                                 ▼
                                      ┌──────────────────────┐
                                      │  postgres (rede      │
                                      │  interna, sem porta  │
                                      │  publicada)          │
                                      └──────────────────────┘
```

Em produção (`docker-compose.yml`), o `frontend` é o único serviço com porta publicada
no host; ele serve os arquivos estáticos da SPA via Nginx e atua como **proxy reverso**
para `/api/`, repassando ao serviço `backend` (acessível apenas pela rede interna do
Compose). O `postgres` fica em uma rede ainda mais restrita, sem rota direta para a
internet — apenas o `backend` o acessa. Esse desenho minimiza a superfície de ataque:
nenhum serviço além do proxy é exposto publicamente.

## Modelo de domínio

As entidades centrais (definidas em `backend/prisma/schema.prisma`):

| Entidade     | Finalidade                                                                    | Observações de privacidade                                                                                             |
| ------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `Usuario`    | Conta de acesso ao sistema (login, papel, sessão)                             | Senha em `argon2id`; `versaoSessao` permite invalidar sessões/refresh tokens em massa (logout global, troca de senha)  |
| `Tecnico`    | Cadastro de técnicos que realizam exames                                      | Documento de identificação cifrado (`documentoCifrado`) + hash de busca determinístico (`documentoHash`)               |
| `Paciente`   | Cadastro de pacientes — **dado de saúde, categoria sensível (LGPD)**          | Documento e contato cifrados; campo `anonimizadoEm` registra quando o registro foi anonimizado pela rotina de retenção |
| `Exame`      | Catálogo de exames oferecidos (nome, código, valor padrão)                    | Sem dados pessoais                                                                                                     |
| `Lancamento` | Registro transacional: técnico + paciente + exame + data + quantidade + valor | Núcleo funcional do sistema; índices alinhados aos filtros pedidos                                                     |
| `AuditLog`   | Trilha de auditoria imutável (somente inserção)                               | Quem fez o quê, quando, de onde — base para responsabilização (accountability)                                         |

### Por que campos cifrados em vez de apenas controle de acesso?

Controles de acesso (RBAC) protegem contra uso indevido **pela aplicação**; cifragem em
nível de campo protege o dado mesmo em cenários de comprometimento mais profundo —
acesso direto ao banco, vazamento de backup, dump de disco. Para CPF e contato (campos
que precisam de busca exata, mas raramente de busca por substring), o padrão
**cifra + hash determinístico** permite:

- Buscar um paciente pelo CPF informado pelo usuário, sem armazenar o CPF em texto claro
  nem decifrar todo o conjunto de dados para comparar.
- Decifrar sob demanda apenas o registro encontrado, e apenas para papéis autorizados —
  a serialização de resposta (`class-transformer`/interceptors) controla quais campos
  decifrados chegam a cada papel.

### Por que soft delete?

`deletadoEm` preserva o histórico de lançamentos e cadastros mesmo após "exclusão" pelo
usuário — essencial para auditoria (não se pode investigar o que não existe mais) e para
a rotina de retenção/anonimização decidir, com base em critérios e prazos, quando um
registro deve de fato ser anonimizado ou expurgado (LGPD, direito ao esquecimento).
Exclusão física imediata eliminaria essa rastreabilidade.

## Backend — módulos NestJS

```
backend/src/
├── auth/         # Login, refresh, logout global, troca de senha; estratégias JWT, guards, RBAC
├── common/       # CryptoService, AuditService/interceptor, Prisma, decorators, paginação, DTOs base
├── usuarios/     # Gestão de usuários do sistema (ADMIN)
├── tecnicos/     # CRUD de técnicos
├── pacientes/    # CRUD de pacientes (dados sensíveis)
├── exames/       # CRUD do catálogo de exames
├── lancamentos/  # Núcleo funcional: CRUD + filtros + resumo + exportação CSV
├── retencao/     # Job agendado de anonimização/retenção (LGPD)
├── health/       # Endpoint de health check (/health) para orquestração
└── config/       # Carregamento e validação de variáveis de ambiente (schema Joi/zod)
```

### Decisões técnicas (ADR resumido)

**1. Prisma ORM sobre PostgreSQL.**
Escolhido por: tipagem ponta-a-ponta gerada a partir do schema (reduz erros de
mapeamento), migrações versionadas e revisáveis (`prisma/migrations/`), e suporte
maduro a `Decimal`/`Json`/enums do PostgreSQL — relevantes para campos monetários
(`valor`, `valorPadrao`) e para a trilha de auditoria (`dadosAntigos`/`dadosNovos`
em `Json`).

**2. Autenticação por par de tokens JWT (access curto + refresh longo) com
`versaoSessao`.**
Tokens de acesso de curta duração (padrão 15 min) limitam a janela de uso de um token
roubado; o refresh token (mais longo, padrão 7 dias) evita reautenticações constantes.
O contador `versaoSessao` em `Usuario`, incrementado em troca de senha ou
"sair de todos os dispositivos", invalida instantaneamente todos os refresh tokens
emitidos antes da mudança — sem precisar de uma tabela de blocklist de tokens.

**3. RBAC com três papéis (`ADMIN`, `GESTOR`, `TECNICO`).**
Modelo simples e auditável, mapeado 1:1 às necessidades do domínio: `ADMIN` administra
usuários e catálogos; `GESTOR` consulta, filtra e exporta; `TECNICO` registra seus
próprios lançamentos. Aplicado via decorator `@Roles(...)` + guard, nunca apenas na UI.

**4. Interceptor de auditoria centralizado, não chamadas manuais espalhadas pelo código.**
Garante cobertura consistente (nenhum desenvolvedor "esquece" de auditar um novo
endpoint sensível) e mantém o formato dos registros uniforme — pré-requisito para uma
trilha de auditoria confiável e consultável.

**5. Cifragem de campos em nível de aplicação (`CryptoService`, AES-256-GCM), não apenas
"encryption at rest" do banco.**
Cifragem em nível de disco (TDE) protege contra furto de mídia física, mas não contra
acesso indevido por uma credencial de banco comprometida nem contra vazamento de backup
lógico (`pg_dump`). Cifrar no nível da aplicação garante que o dado sensível nunca
trafega nem é persistido em texto claro fora da memória do processo backend.

**6. Validação global de DTOs com `whitelist`/`forbidNonWhitelisted`.**
Rejeita automaticamente qualquer campo não esperado no payload — reduz superfície de
ataque (mass assignment) e força contratos de API explícitos.

**7. Logs estruturados (Pino) sem PII.**
Mensagens de log usam identificadores técnicos (IDs, ações, status), nunca nomes,
documentos ou dados de saúde — para que os próprios logs não se tornem um vetor de
vazamento de dados sensíveis.

## Frontend — organização

```
frontend/src/
├── api/          # Clientes HTTP (Axios) por recurso + interceptors de sessão
├── auth/         # Contexto de autenticação, armazenamento de sessão (sessionStorage)
├── routes/       # Rotas protegidas por papel (RBAC no roteamento)
├── components/   # Componentes compartilhados (layout, navegação)
├── pages/        # Telas: Login, Painel, Técnicos, Pacientes, Exames, Lançamentos
└── types/        # Tipos de domínio compartilhados com o backend (contratos)
```

Decisões relevantes: sessão mantida em `sessionStorage` (não `localStorage`, reduzindo
a janela de exposição a XSS persistente — o token não sobrevive ao fechamento da aba);
TanStack React Query para cache/revalidação de dados de servidor; Mantine como biblioteca
de UI (acessibilidade e formulários prontos, reduzindo código customizado e sua
superfície de erro).

## Infraestrutura — Docker e orquestração

- **Dockerfiles multi-stage**: estágio de build instala dependências e compila;
  estágio de execução copia somente os artefatos necessários, roda como **usuário não
  root** e usa imagens `alpine`/`nginx-unprivileged` enxutas — reduz superfície de
  ataque e tamanho de imagem.
- **`docker-compose.yml`** (produção): rede interna isolada para o banco, healthchecks
  em todos os serviços, `depends_on: condition: service_healthy` (o backend só inicia
  após o banco responder; o frontend, após o backend).
- **`docker-compose.dev.yml`** (overlay de desenvolvimento): adiciona o `adminer` e
  publica a porta do PostgreSQL no host — nunca usado em produção.
- **Migrações e seed automáticos**: aplicados na inicialização do contêiner `backend`,
  garantindo que o ambiente suba em estado consistente sem passos manuais.

## Pipeline de CI/CD (DevSecOps)

Ver [`.github/workflows/`](../.github/workflows/) e detalhes em
[SEGURANCA_E_PRIVACIDADE.md](SEGURANCA_E_PRIVACIDADE.md):

- `ci.yml` — lint, formatação, checagem de tipos, testes com cobertura e build (backend
  e frontend), além do build das imagens Docker.
- `codeql.yml` — análise estática de segurança (SAST) via CodeQL.
- `security.yml` — varredura de segredos (gitleaks), auditoria de dependências
  (`npm audit`, com gate obrigatório em vulnerabilidades críticas de produção) e
  varredura de imagens de contêiner (Trivy), com publicação dos achados no GitHub
  Security.
