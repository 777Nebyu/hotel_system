# syntax=docker/dockerfile:1

FROM node:20-slim AS build
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json prisma.config.ts ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/typescript-config/package.json ./packages/typescript-config/

RUN pnpm install --frozen-lockfile

COPY apps ./apps
COPY packages ./packages

RUN pnpm turbo run build --filter=api --output-logs=errors-only

RUN pnpm --filter api deploy --prod /out/api
RUN cp -r apps/api/dist /out/api/dist

FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/api ./
EXPOSE 3001
CMD ["node", "dist/src/main"]