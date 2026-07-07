# Guia de Instalação

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e Docker Compose v2 (`docker compose version`)
- Git
- Para desenvolvimento sem Docker: Node.js 20+ e PostgreSQL 16+

## 1. Instalação via Docker Compose (recomendada)

Esta é a forma recomendada de executar o sistema — sobe banco de dados, backend e
frontend já orquestrados, com healthchecks e dependências corretamente ordenadas.

### 1.1. Clonar o repositório e configurar variáveis de ambiente

```bash
git clone <repositório> exames-sistema
cd exames-sistema
cp .env.example .env
```

Edite `.env` e **substitua todos os valores de exemplo** por segredos fortes e
exclusivos deste ambiente. Nunca reutilize os valores de exemplo nem faça commit do
arquivo `.env`. Gere segredos com:

```bash
openssl rand -base64 48   # JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
openssl rand -base64 32   # DATA_ENCRYPTION_KEY (cifragem AES-256-GCM)
```

| Variável                                                           | Descrição                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`              | Credenciais do banco PostgreSQL                                                                                                                                                                                                                                                                                                   |
| `POSTGRES_PORT`                                                    | Porta do banco publicada no host **apenas** pelo overlay de desenvolvimento (padrão `5433`, evitando colisão com instâncias nativas do PostgreSQL na porta 5432)                                                                                                                                                                  |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRES_IN`                      | Segredo e validade do token de acesso (curta duração)                                                                                                                                                                                                                                                                             |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN`                    | Segredo e validade do token de atualização (sessão)                                                                                                                                                                                                                                                                               |
| `DATA_ENCRYPTION_KEY`                                              | Chave usada para cifrar campos sensíveis (CPF, contato) em nível de aplicação — AES-256-GCM                                                                                                                                                                                                                                       |
| `TURNSTILE_SECRET_KEY` / `VITE_TURNSTILE_SITE_KEY`                 | Par secret/site key do desafio Cloudflare Turnstile (CAPTCHA anti-bot exibido no login) — gere o seu em https://dash.cloudflare.com/?to=/:account/turnstile; em desenvolvimento, use as [chaves de teste oficiais da Cloudflare](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) (sempre aprovam o desafio) |
| `CORS_ALLOWED_ORIGINS`                                             | Lista de origens autorizadas a consumir a API (separadas por vírgula)                                                                                                                                                                                                                                                             |
| `THROTTLE_TTL_SECONDS` / `THROTTLE_LIMIT` / `THROTTLE_LOGIN_LIMIT` | Limites de taxa de requisições (gerais e de login)                                                                                                                                                                                                                                                                                |
| `DATA_RETENTION_DAYS`                                              | Período de retenção (em dias) antes da anonimização programada de pacientes inativos                                                                                                                                                                                                                                              |
| `LOG_LEVEL`                                                        | Nível dos logs estruturados (`info`, `debug`, `warn`, `error`)                                                                                                                                                                                                                                                                    |
| `VITE_API_BASE_URL`                                                | Caminho base da API consumido pelo frontend (`/api/v1` — proxy reverso via Nginx)                                                                                                                                                                                                                                                 |
| `FRONTEND_PORT`                                                    | Porta publicada no host pelo serviço `frontend` (padrão `8080`)                                                                                                                                                                                                                                                                   |
| `ADMINER_PORT`                                                     | Porta do Adminer — **apenas** no overlay de desenvolvimento                                                                                                                                                                                                                                                                       |

### 1.2. Subir os contêineres

**Produção / homologação** (apenas os serviços essenciais, rede do banco isolada):

```bash
docker compose up -d --build
```

**Desenvolvimento** (adiciona o Adminer e expõe a porta do PostgreSQL no host):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Acompanhe a inicialização com `docker compose ps` — aguarde todos os serviços
reportarem `healthy`. As migrações do banco são aplicadas e o **seed inicial** é
executado automaticamente na subida do contêiner `backend`.

### 1.3. Capturar as credenciais do administrador inicial

Na **primeira subida** (quando o usuário `admin@exames.local` ainda não existe), o
seed roda automaticamente ao iniciar o contêiner `backend` e cria um usuário `ADMIN`
com **senha aleatória impressa uma única vez** no log — procure por um bloco como:

```
================================================================
 Usuário administrador criado.
 E-mail: admin@exames.local
 Senha temporária (anote agora — não será exibida novamente):
   <sequência aleatória aqui>
 >>> Troque esta senha imediatamente após o primeiro login. <<<
================================================================
```

**Linux/macOS (bash):**

```bash
docker compose logs backend | grep -A4 "Usuário administrador criado"
```

**Windows (PowerShell):**

```powershell
docker compose logs backend | Select-String -Pattern "Usuário administrador criado" -Context 0,4
```

Anote a senha exibida — ela não pode ser recuperada depois. **Troque-a imediatamente**
após o primeiro login (menu do usuário → "Alterar senha").

> **Não encontrou esse bloco no log?** Isso significa que o seed já encontrou um
> usuário `admin@exames.local` existente (reinicializações subsequentes não geram
> uma nova senha — o seed é idempotente) **ou** que o contêiner `backend` está
> rodando uma imagem construída antes da automação do seed. No segundo caso, refaça
> o build (`docker compose up -d --build backend`) e repita a verificação. Se ainda
> assim não houver credenciais utilizáveis, redefina a senha do administrador
> seguindo o procedimento da seção [1.6](#16-redefinir-a-senha-do-administrador-caso-a-credencial-inicial-tenha-sido-perdida).

### 1.4. Acessar o sistema

- Frontend: `http://localhost:8080` (ou a porta definida em `FRONTEND_PORT`)
- Documentação interativa da API (Swagger): `http://localhost:8080/api/v1/docs`
  (disponível apenas fora de `NODE_ENV=production`, conforme configurado em `main.ts`)
- Adminer (apenas com o overlay de desenvolvimento): `http://localhost:8081`

> **Indo para produção com domínio próprio?** Este guia cobre apenas o acesso em HTTP
> local (`http://localhost:8080`). Antes de expor o sistema à Internet, configure HTTPS
> com certificado válido — veja o passo a passo completo (Windows e Linux) em
> [CONFIGURACAO_HTTPS.md](CONFIGURACAO_HTTPS.md).

### 1.5. Parar e remover os contêineres

```bash
docker compose down            # mantém os dados (volume nomeado do PostgreSQL)
docker compose down -v         # remove também os dados — use com cautela
```

### 1.6. Redefinir a senha do administrador (caso a credencial inicial tenha sido perdida)

A senha gerada pelo seed é exibida **uma única vez** e não fica salva em lugar algum
em texto claro (o banco armazena apenas o hash `argon2id`, irreversível). Se ela foi
perdida antes da troca, restaure o acesso por uma das vias abaixo — da mais simples
para a mais invasiva:

**a) Já existe outro usuário `ADMIN` com senha conhecida?**
Peça para essa pessoa entrar e usar **Usuários → Redefinir senha** sobre a conta
afetada (gera uma nova senha temporária e encerra as sessões daquele usuário).

**b) Ninguém consegue entrar como `ADMIN` — apague o usuário e deixe o seed recriá-lo.**
O seed só cria `admin@exames.local` se ele **não existir** — então remover esse
registro do banco faz com que ele seja recriado (com uma nova senha temporária
impressa no log) na próxima vez que o contêiner `backend` subir.

```bash
# 1. Acesse o psql dentro do contêiner do banco (ajuste usuário/banco conforme seu .env)
docker compose exec postgres psql -U exames_app -d exames_db

# 2. Dentro do psql, remova o usuário admin padrão:
DELETE FROM usuarios WHERE email = 'admin@exames.local';
\q

# 3. Reinicie o backend — o seed roda novamente e recria o admin com nova senha:
docker compose restart backend

# 4. Capture a nova senha no log (ver passo 1.3):
docker compose logs backend | grep -A4 "Usuário administrador criado"
```

> Alternativamente, com o overlay de desenvolvimento ativo
> (`docker-compose.dev.yml`), use o **Adminer** (`http://localhost:8081`) para
> remover o registro pela interface gráfica, em vez do `psql`.

> Removê-lo é seguro mesmo que essa conta já tenha sido usada: o histórico de
> lançamentos referencia o usuário por `criadoPorId`; se o registro de auditoria
> ou de lançamentos apontar para esse `ADMIN`, prefira a opção (a) ou crie um novo
> `ADMIN` por outra via, evitando excluir contas com histórico vinculado.

## 2. Instalação manual (desenvolvimento sem Docker)

Útil para depuração local com hot-reload nativo das ferramentas (Nest CLI, Vite).

### 2.1. Banco de dados

Suba um PostgreSQL 16 local ou em contêiner avulso e crie um banco e usuário dedicados:

```sql
CREATE USER exames_app WITH PASSWORD 'sua-senha-local';
CREATE DATABASE exames_db OWNER exames_app;
```

### 2.2. Backend

```bash
cd backend
cp .env.example .env     # ajuste DATABASE_URL e demais variáveis para o ambiente local
npm install
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

A API ficará disponível em `http://localhost:3000/api/v1`.

### 2.3. Frontend

```bash
cd frontend
cp .env.example .env     # ajuste VITE_API_BASE_URL e VITE_TURNSTILE_SITE_KEY para o ambiente local
npm install
npm run dev
```

> O `.env.example` já traz a [chave de teste oficial da Cloudflare](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
> para `VITE_TURNSTILE_SITE_KEY` (sempre aprova o desafio, útil para desenvolvimento sem
> depender de uma conta Cloudflare); combine-a com `TURNSTILE_SECRET_KEY` equivalente no
> `backend/.env`, ou substitua ambas pelo par real gerado em
> https://dash.cloudflare.com/?to=/:account/turnstile.

A SPA ficará disponível em `http://localhost:5173`, configurada (via `VITE_API_BASE_URL`
no `.env` do frontend) para falar com o backend local.

## 3. Hooks de pré-commit (ambiente de desenvolvimento)

Na raiz do repositório:

```bash
npm install
```

Isso instala Husky e lint-staged e registra o hook `pre-commit`, que roda ESLint
(com correção automática) nos arquivos staged de `backend/` e `frontend/`, e Prettier
em arquivos `json`/`md`/`yml`/`yaml` — barrando commits com problemas de lint antes
que cheguem ao repositório remoto.

## 4. Solução de problemas comuns

| Sintoma                                                          | Causa provável                                                                      | Solução                                                                                                                                                        |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P1000: Authentication failed` ao migrar contra `localhost:5432` | Outra instância do PostgreSQL (nativa do SO) já escuta na porta 5432                | Use a porta alternativa exposta pelo overlay de dev (`POSTGRES_PORT=5433`)                                                                                     |
| `Could not parse schema engine response` no contêiner do backend | Faltam bibliotecas OpenSSL/binary target compatíveis com Alpine                     | Já corrigido no `Dockerfile`/`schema.prisma` deste repositório (`linux-musl-openssl-3.0.x` + `apk add openssl`); ao customizar a imagem, preserve essas linhas |
| `Cannot find module 'dist/main.js'`                              | Caminho de saída do build do Nest difere do esperado                                | O `Dockerfile` já aponta para `dist/src/main.js`, conforme `sourceRoot`/`outDir` do projeto                                                                    |
| Frontend carrega mas chamadas a `/api/...` retornam 502/404      | Backend ainda não está `healthy` ou variável `VITE_API_BASE_URL` incorreta no build | Aguarde o healthcheck do backend; rebuilde o frontend após corrigir a variável (ela é injetada em tempo de build)                                              |
