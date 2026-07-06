FROM node:20-bookworm-slim

WORKDIR /app

COPY . .

RUN corepack enable
RUN corepack prepare pnpm@10.24.0 --activate
RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["pnpm", "exec", "ts-node", "-r", "tsconfig-paths/register", "--transpile-only", "src/main.ts"]
