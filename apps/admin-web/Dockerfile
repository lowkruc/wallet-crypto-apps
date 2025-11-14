# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
WORKDIR /usr/src/app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
RUN pnpm install --filter admin-web... --frozen-lockfile

FROM deps AS build
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN pnpm --filter admin-web build

FROM node:20-alpine AS runner
WORKDIR /usr/src/app/apps/admin-web
RUN npm install -g serve
COPY --from=build /usr/src/app/apps/admin-web/dist ./dist
ENV PORT=4173
EXPOSE 4173
CMD ["serve", "-s", "dist", "-l", "4173"]
