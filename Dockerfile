FROM node:24-alpine as build

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

FROM caddy:2-alpine as prod
COPY --from=build /app/dist /usr/share/caddy
