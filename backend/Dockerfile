# Two stages: the first has the full devDependencies (typescript, the
# prisma CLI) needed to compile; the second only ever installs production
# dependencies, so the final image doesn't ship a compiler it'll never use.
FROM node:26-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

COPY . .
# prisma.config.ts requires DATABASE_URL to even load (see its env("DATABASE_URL")
# call) before `prisma generate` gets anywhere near actually needing it - it
# never connects to this, it only has to resolve to something at load time.
# The real value is supplied at container RUNTIME instead (see
# docker-compose.prod.yml), which is the only place it actually matters.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm run build

FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --omit=dev
# The generated Prisma client is tied to this exact node_modules install,
# not just copyable from the builder stage - regenerating here (fast, no
# network needed beyond what npm ci already required) keeps it consistent
# with the production-only dependency tree actually shipped in this image.
# Same placeholder-DATABASE_URL reasoning as the builder stage above.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate
ENV DATABASE_URL=

COPY --from=builder /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/index.js"]
