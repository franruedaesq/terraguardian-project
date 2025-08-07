FROM alpine:3.18 AS base

RUN apk add --no-cache terraform nodejs npm

FROM base AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM base AS final
WORKDIR /app

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules

COPY --from=builder /usr/src/app/package.json ./

# This will be the directory where the victim repo is checked out
VOLUME /app/infrastructure

CMD ["node", "dist/main.js"]