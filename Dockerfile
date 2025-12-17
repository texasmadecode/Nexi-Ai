# Nexi AI - Dockerfile
FROM node:20-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create data directory
RUN mkdir -p /app/data

# Set environment variables
ENV NODE_ENV=production
ENV NEXI_DATA_DIR=/app/data

# Expose any needed ports (if running as a service)
# EXPOSE 3000

# Default command - run the chat interface
CMD ["node", "dist/interfaces/console.js"]
