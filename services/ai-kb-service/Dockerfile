FROM node:20-slim AS build
WORKDIR /app
COPY package.json ./
# Use npm install (no lockfile committed yet); switch to `npm ci` once package-lock.json exists.
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY src/public ./dist/public
EXPOSE 4000
# Run migrations then start (idempotent CREATE TABLE IF NOT EXISTS).
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
