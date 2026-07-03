# Build
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve
FROM nginx:1.25-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# SPA fallback
RUN sed -i 's/try_files \$uri \/index.html;/try_files \$uri \$uri\/ \/index.html;/' /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
