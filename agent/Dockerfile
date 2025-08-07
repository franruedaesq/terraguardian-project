FROM alpine:3.20 AS base

RUN apk add --no-cache nodejs npm wget unzip && \
    wget https://releases.hashicorp.com/terraform/1.9.0/terraform_1.9.0_linux_amd64.zip && \
    unzip terraform_1.9.0_linux_amd64.zip && \
    mv terraform /usr/local/bin/ && \
    rm terraform_1.9.0_linux_amd64.zip

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

VOLUME /app/infrastructure

CMD ["node", "dist/main.js"]