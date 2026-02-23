# Frontend — self-contained build, served by nginx
# Build context: packages/frontend/  (Railway uploads from CWD of deploy script)

FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json ./
RUN pnpm install --no-frozen-lockfile

COPY . .

# Build-time env vars (baked into the static bundle)
ARG VITE_CLIENT_URL=http://localhost:3001
ARG VITE_BASE_PATH=/
ENV VITE_CLIENT_URL=$VITE_CLIENT_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH

RUN pnpm build

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Use nginx template so PORT env var (set by Railway) is substituted at startup
RUN mkdir -p /etc/nginx/templates && \
    printf 'server {\n  listen ${PORT};\n  root /usr/share/nginx/html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' \
    > /etc/nginx/templates/default.conf.template && \
    rm /etc/nginx/conf.d/default.conf

EXPOSE 8080
