# Imagens de produção: `api` (NestJS + Prisma) e `web` (nginx com os dois apps).
# Build: docker build -f deploy/Dockerfile --target api -t cardapio-api .
#        docker build -f deploy/Dockerfile --target web -t cardapio-web \
#          --build-arg VITE_EQUIPE_URL=https://cardapio-equipe.devyank.com .

FROM node:22-alpine AS build
RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@10.34.9 --activate
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
ARG VITE_EQUIPE_URL
ENV VITE_EQUIPE_URL=$VITE_EQUIPE_URL
RUN pnpm --filter api exec prisma generate \
 && pnpm --filter api build \
 && pnpm --filter cliente build \
 && pnpm --filter equipe build
# Seed da demo compilado (roda uma vez no servidor, banco vazio).
RUN cd apps/api && pnpm exec tsc prisma/seed.ts --outDir dist-seed \
      --module commonjs --target es2022 --esModuleInterop --skipLibCheck
# Só as dependências de produção da API.
RUN pnpm --filter api deploy --legacy --prod /out \
 && cp -r apps/api/dist apps/api/dist-seed apps/api/prisma apps/api/scripts /out/ \
 && cd /out && npx -y prisma@6.19.3 generate --schema prisma/schema.prisma

FROM node:22-alpine AS api
RUN apk add --no-cache openssl && npm i -g prisma@6.19.3 && npm cache clean --force
WORKDIR /app
COPY --from=build /out .
ENV NODE_ENV=production
EXPOSE 3000
# Migra (só aplica as que faltam) e sobe.
CMD ["sh", "-c", "prisma migrate deploy --schema prisma/schema.prisma && node dist/main.js"]

FROM nginx:alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/comum.inc /etc/nginx/conf.d/comum.inc
COPY --from=build /repo/apps/cliente/dist /srv/cliente
COPY --from=build /repo/apps/equipe/dist /srv/equipe
