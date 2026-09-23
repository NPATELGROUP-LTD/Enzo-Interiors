# Enzo Interiors — Admin CRM + CMS (React/Vite SPA).
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Vite inlines VITE_* at build time, so these are build arguments rather than
# runtime environment. A different API host means a different image.
ARG VITE_API_BASE_URL
ARG VITE_WEB_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_WEB_URL=$VITE_WEB_URL
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
# The image renders templates/*.template into conf.d at start, substituting
# API_PUBLIC_URL and MEDIA_BASE_URL into the Content-Security-Policy.
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx /etc/nginx/templates
EXPOSE 80
