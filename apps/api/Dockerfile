# Enzo Interiors — API (NestJS + Prisma).
FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first, so a source-only change does not reinstall them.
COPY package.json package-lock.json ./
RUN npm ci

# The Prisma client is generated from the schema, so the schema has to be in
# place before `prisma generate` runs as part of the build script.
COPY prisma ./prisma
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# The content import, run by the compose `seed` service on every deploy. Has
# tsx (a dev dependency) from `build`, and bakes in the shipped content rather
# than bind-mounting it, because a deploy host may not have the repo on disk.
# `webdata` and `seedmedia` are named contexts from docker-compose.yml
# (additional_contexts); the API image never builds this stage, so a plain
# `docker build` of apps/api does not need them.
FROM build AS seed
COPY --from=webdata . /web/src/data
COPY --from=seedmedia . ./seed-media
USER node

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Production dependencies only, then the generated client and compiled output.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
# Kept so migrations and the content import can be run inside the container.
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/tsconfig.json /app/tsconfig.scripts.json ./

# Runs unprivileged. The node image ships this user already.
USER node
EXPOSE 4000

# Migrations are applied at start rather than baked into the image, so a
# rollback of the image does not leave the schema ahead of the code.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
