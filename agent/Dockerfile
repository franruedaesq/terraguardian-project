# ---- Base Stage ----
FROM alpine:3.18 AS base
# Install Terraform and other dependencies
RUN apk add --no-cache terraform nodejs npm

# ---- Builder Stage ----
FROM base AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ---- Final Stage ----
FROM base AS final
WORKDIR /app
# Copy built code and dependencies from the builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules

# This will be the directory where the victim repo is checked out
VOLUME /app/infrastructure

CMD ["node", "dist/main.js"]