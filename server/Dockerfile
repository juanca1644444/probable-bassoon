# ==============================================================================
# CHASKYAPP - Backend Production Dockerfile
# Optimized lightweight Alpine container with multi-stage compilation for better-sqlite3
# ==============================================================================

# Stage 1: Build native dependencies (better-sqlite3 node-gyp)
FROM node:20-alpine AS builder

WORKDIR /app

# Install native build tools required by node-gyp & better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./

# Install production dependencies only and compile native addons
RUN npm ci --omit=dev

# Stage 2: Minimal Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

# Install sqlite-tools for database maintenance, backups, and integrity checks
RUN apk add --no-cache sqlite tzdata

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/chaskyapp.db
ENV UPLOAD_DIR=/app/uploads

# Create directories for persistent volumes
RUN mkdir -p /app/data /app/uploads && \
    chown -R node:node /app

# Copy application source code (respecting .dockerignore)
COPY --chown=node:node . ./

# Copy compiled native dependencies (better-sqlite3) from builder stage
COPY --chown=node:node --from=builder /app/node_modules ./node_modules

# Run as non-privileged user for enhanced container security
USER node

# Expose backend API and WebSocket port
EXPOSE 3001

# Healthcheck to ensure Express and SQLite are actively responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/chats || exit 1

# Start CHASKYAPP Server
CMD ["node", "index.js"]
