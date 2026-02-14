FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install Docker CLI for sibling container management
RUN apk add --no-cache docker-cli

# Copy source code
COPY src ./src

# Create non-root user (Commented out for Docker socket access)
# RUN addgroup -g 1001 -S nodejs && \
#     adduser -S nodejs -u 1001

# USER nodejs

EXPOSE 3000

CMD ["node", "src/index.js"]
