# ==============================================================================
# CHASKYAPP - Frontend Production Dockerfile
# Multi-stage: Vite build -> Nginx Alpine static serving & reverse proxy
# ==============================================================================

# Stage 1: Build React/Vite application
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies with frozen lockfile
COPY package*.json ./
RUN npm ci

# Copy application source code
COPY . .

# Build production bundle to dist/
RUN npm run build

# Stage 2: Minimal Nginx web server
FROM nginx:1.25-alpine AS runner

# Remove default nginx configurations
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Healthcheck to verify Nginx serves the index.html page
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
