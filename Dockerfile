FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Copy all workspace package.json files (for npm ci workspace resolution)
COPY packages/core/package.json packages/core/
COPY packages/horarios/package.json packages/horarios/
COPY apps/server/package.json apps/server/

RUN npm ci

# Copy all source code
COPY tsconfig.base.json ./
COPY packages/core/tsconfig.json packages/core/
COPY packages/horarios/tsconfig.json packages/horarios/
COPY apps/server/tsconfig.json apps/server/
COPY packages/core/src packages/core/src
COPY packages/horarios/src packages/horarios/src
COPY packages/horarios/frontend packages/horarios/frontend
COPY apps/server/src apps/server/src

# Build all packages
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Copy package.jsons for workspace resolution
COPY package.json ./
COPY packages/core/package.json packages/core/
COPY packages/horarios/package.json packages/horarios/
COPY apps/server/package.json apps/server/

# Copy node_modules (includes workspace symlinks)
COPY --from=builder /app/node_modules ./node_modules

# Copy built dist files
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/horarios/dist ./packages/horarios/dist
COPY --from=builder /app/packages/horarios/frontend ./packages/horarios/frontend
COPY --from=builder /app/apps/server/dist ./apps/server/dist

EXPOSE 3000

CMD ["node", "apps/server/dist/index.js"]
