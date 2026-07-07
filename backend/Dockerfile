# syntax=docker/dockerfile:1

# ---- Etapa 1: dependências e build -----------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Prisma precisa do OpenSSL para detectar/gerar a engine binária correta em musl
RUN apk add --no-cache openssl

# Copia apenas os manifestos primeiro para aproveitar o cache de camadas
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build
# O script de seed (prisma/seed.ts) fica fora de "src" e não é compilado pelo
# "nest build". Compila-se aqui, separadamente, para JS plano executável com
# "node" puro — o seed precisa rodar na imagem de produção (sem ts-node, que é
# devDependency e é removido no "npm prune" abaixo) para garantir que o usuário
# ADMIN inicial e o catálogo de exames existam já na primeira subida.
RUN npx tsc prisma/seed.ts --outDir dist/prisma --module commonjs --target es2021 \
      --esModuleInterop --skipLibCheck --moduleResolution node
RUN npm prune --omit=dev

# ---- Etapa 2: imagem de execução (mínima, não-root) -------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Necessário em runtime para a engine binária do Prisma Client (musl/OpenSSL 3)
# e para o módulo de backup/restauração, que usa pg_dump/pg_restore (versão 16
# para corresponder à versão do servidor PostgreSQL usada no docker-compose.yml).
RUN apk add --no-cache openssl postgresql16-client

# Usuário não-root dedicado — reduz o impacto de uma eventual exploração
# de vulnerabilidade no processo da aplicação (security by design).
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Diretório onde os arquivos de backup ficam armazenados (montado como volume
# persistente em produção — ver docker-compose.yml). Criado e ajustado aqui
# para que o usuário não-root "appuser" tenha permissão de escrita.
RUN mkdir -p /var/backups/exames && chown appuser:appgroup /var/backups/exames

COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --from=build --chown=appuser:appgroup /app/prisma ./prisma
COPY --from=build --chown=appuser:appgroup /app/package.json ./package.json

USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3001/api/v1/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Aplica migrações pendentes, executa o seed (idempotente — cria o usuário ADMIN
# inicial e o catálogo de exames apenas se ainda não existirem) e então inicia a API.
CMD ["sh", "-c", "node ./node_modules/.bin/prisma migrate deploy && node dist/prisma/seed.js && node dist/src/main.js"]
