# Enzo Interiors — public site (Next.js).
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# NEXT_PUBLIC_* are inlined into the client bundle at build time, so they are
# build arguments rather than runtime environment.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_API_PUBLIC_URL
ARG NEXT_PUBLIC_MEDIA_BASE_URL
# Read while prerendering (canonical and share URLs), so needed at build too.
ARG SITE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL     NEXT_PUBLIC_API_PUBLIC_URL=$NEXT_PUBLIC_API_PUBLIC_URL     NEXT_PUBLIC_MEDIA_BASE_URL=$NEXT_PUBLIC_MEDIA_BASE_URL     SITE_URL=$SITE_URL

# The build reads the API once to prerender. If it is unreachable the content
# layer falls back to the committed JSON in src/data, so the image still
# builds and still ships a complete site.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

# `output: standalone` produces exactly what the server needs, so nothing is
# installed in this stage.
COPY --from=build /app/public ./public
# Fonts and the mark for the generated share cards (src/app/og).
COPY --from=build /app/assets ./assets
# Owned by `node`: the server writes its page cache under .next at runtime
# (after a content change), and a root-owned .next makes that fail.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
