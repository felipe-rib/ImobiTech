FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY backend backend
COPY database database
COPY scripts/test-in-container.mjs scripts/test-in-container.mjs
RUN npm run build -w backend
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "backend/dist/server.js"]
