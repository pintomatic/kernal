FROM node:22-slim

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
COPY bin/ ./bin/
RUN npx tsc

# Create data directory
RUN mkdir -p /data

ENV PORT=8080
ENV KERNAL_DB_PATH=/data/kernal.db

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["node", "dist/src/cloud.js"]
