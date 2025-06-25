# Multi-stage Dockerfile for Payslip Generation System

# Base stage
FROM node:18-alpine AS base
LABEL maintainer="Payslip System Team"
LABEL description="Payslip Generation System - Node.js Application"

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    curl \
    postgresql-client \
    tzdata \
    && rm -rf /var/cache/apk/*

# Set timezone (can be overridden with build arg)
ARG TZ=UTC
ENV TZ=${TZ}
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S payslip -u 1001 -G nodejs

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development

# Install all dependencies (including dev dependencies)
RUN npm ci --include=dev

# Install nodemon globally for development
RUN npm install -g nodemon

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose ports (app + debugger)
EXPOSE 3000 9229

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start in development mode with debugging
CMD ["npm", "run", "dev"]

# Production dependencies stage
FROM base AS prod-deps

# Install only production dependencies
RUN npm ci --only=production --omit=dev && \
    npm cache clean --force

# Production stage
FROM base AS production

# Copy production dependencies
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Create logs directory and set permissions
RUN mkdir -p logs && \
    chown -R nodejs:nodejs . && \
    chmod -R 755 .

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start in production mode
CMD ["npm", "start"]
