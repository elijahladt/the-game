# Multi-stage Dockerfile for Quickfire Authoritative Server
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root and package manifests
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm install

# Copy source files
COPY shared/ ./shared/
COPY server/ ./server/

# Build shared and server
RUN npm run build --workspace=@quickfire/shared
RUN npm run build --workspace=@quickfire/server

# Runner stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/

RUN npm install --omit=dev

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/dist ./server/dist

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
