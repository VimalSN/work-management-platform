# Vite bakes VITE_* env vars into the built JS at build time, not read at
# container startup - the API URL has to be known as a build argument, not
# as a runtime environment variable the way the backend's env vars work.
FROM node:26-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# The build output is a handful of static files - nginx serves them without
# needing Node (or any of its dependencies) in the final image at all.
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
