# Two stages: the first has the full devDependencies (typescript, the
# prisma CLI) needed to compile; the second only ever installs production
# dependencies, so the final image doesn't ship a compiler it'll never use.
FROM node:26-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build

FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
# The generated Prisma client is tied to this exact node_modules install,
# not just copyable from the builder stage - regenerating here (fast, no
# network needed beyond what npm ci already required) keeps it consistent
# with the production-only dependency tree actually shipped in this image.
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/index.js"]
