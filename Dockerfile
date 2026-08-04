# AudioSpriter Dockerfile (static PWA, Chrome-only)
FROM node:25-alpine AS builder

ARG VERSION=dev-unknown
ENV VITE_APP_VERSION=${VERSION}

WORKDIR /app
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
RUN npm install -g pnpm@10.0.0 && pnpm install --frozen-lockfile

# Copies source + runs prebuild (copies ffmpeg core into public/ffmpeg) + vite build (+ PWA SW)
COPY . .
RUN pnpm run build

# Use stable alpine (nginx 1.28) which matches Alpine repos brotli module
FROM docker.io/nginx:1.28.2-alpine

# Install brotli module from Alpine v3.19 main
RUN apk add --no-cache nginx-mod-http-brotli

COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/nginx.conf

EXPOSE 8000
CMD ["nginx", "-g", "daemon off;"]
