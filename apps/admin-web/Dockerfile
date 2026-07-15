FROM node:20-bookworm-slim

WORKDIR /app

RUN corepack enable
RUN corepack prepare pnpm@10.24.0 --activate

COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ticketbox/admin-web build

WORKDIR /app/apps/admin-web

EXPOSE 3002

CMD ["pnpm", "exec", "next", "start", "-p", "3002", "-H", "0.0.0.0"]
