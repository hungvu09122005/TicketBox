FROM node:20-alpine

WORKDIR /app

COPY . .

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

RUN pnpm --filter @ticketbox/api build

WORKDIR /app/apps/api

CMD ["node", "dist/main.js"]