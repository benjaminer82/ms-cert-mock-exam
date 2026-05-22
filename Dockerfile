# syntax=docker/dockerfile:1.7

# ---------- Build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# Install deps with cached layer
COPY package.json package-lock.json* ./
RUN npm ci

# Build the SPA
COPY . .
RUN npm run build

# ---------- Runtime stage ----------
FROM nginx:1.27-alpine AS runtime

# SPA-friendly nginx config (history fallback to index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets
COPY --from=build /app/dist /usr/share/nginx/html

# Azure App Service for Containers expects the app to listen on $PORT (default 8080).
# Our nginx.conf listens on 8080.
EXPOSE 8080

# Healthcheck so App Service / Container Apps can detect readiness
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
